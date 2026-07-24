import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ICreateProjectProps } from "./ICreateProjectProps.ts";
import type { IEvidenceProject } from "./IEvidenceProject.ts";
import { linkDirectory } from "./linkDirectory.ts";
import { resolveDependency } from "./resolveDependency.ts";
import { suiteRoot } from "./suiteRoot.ts";

/**
 * Materializes a throwaway project wired to the real toolchain.
 *
 * The linked dependencies are the point. A fixture that imported the rules
 * directly would prove the Go compiles, not that a consumer can use it: ttsc
 * has to resolve `@samchon/lint-plugin-evidence` from node_modules, read its
 * descriptor, find the `source` directory inside the package, and link that Go
 * into its own binary. Every one of those steps is a place packaging can break
 * while every unit test stays green.
 */
export const createProject = (props: ICreateProjectProps): IEvidenceProject => {
  const directory: string = fs.mkdtempSync(
    path.join(os.tmpdir(), `evidence-${props.name}-`),
  );

  const write = (relative: string, content: string): void => {
    const location: string = path.join(directory, relative);
    fs.mkdirSync(path.dirname(location), { recursive: true });
    fs.writeFileSync(location, content, "utf8");
  };

  write(
    "package.json",
    JSON.stringify(
      { name: `fixture-${props.name}`, private: true, type: "module" },
      null,
      2,
    ),
  );
  write(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "esnext",
          module: "nodenext",
          moduleResolution: "nodenext",
          esModuleInterop: true,
          strict: true,
          noEmit: true,
          plugins: [{ transform: "@ttsc/lint" }],
          ...(props.compilerOptions ?? {}),
        },
        include: props.include ?? ["src", "lint.config.ts"],
      },
      null,
      2,
    ),
  );
  write("lint.config.ts", props.lintConfig);
  for (const [relative, content] of Object.entries(props.files))
    write(relative, content);

  // Link rather than install: the workspace build is what is under test, and an
  // npm-resolved copy would be testing whatever was last published. Materialize
  // the package's publishConfig entry points instead of exposing its
  // development-only TypeScript source entry to the consumer.
  //
  // `typescript` is linked too because ttsc refuses to start without the native
  // compiler resolvable from the consuming project — it is a real consumer
  // requirement, not a test artifact.
  const modules: string = path.join(directory, "node_modules");
  fs.mkdirSync(path.join(modules, "@samchon"), { recursive: true });
  fs.mkdirSync(path.join(modules, "@ttsc"), { recursive: true });
  linkEvidencePackage(modules);
  linkDirectory(
    resolveDependency("@ttsc/lint"),
    path.join(modules, "@ttsc", "lint"),
  );
  linkDirectory(
    resolveDependency("typescript"),
    path.join(modules, "typescript"),
  );
  linkDirectory(resolveDependency("ttsc"), path.join(modules, "ttsc"));

  return { directory, cleanup: () => cleanupQuietly(directory) };
};

/**
 * Removes a fixture, tolerating a temp directory Windows will not release.
 *
 * The toolchain holds handles under the fixture (its plugin build cache, and
 * the junctions into the workspace), so a removal immediately after the process
 * exits can lose a race with the OS and raise EBUSY. A leftover temp directory
 * is litter; a test that reports failure because of that litter is a lie about
 * the code under test, and the whole point of this suite is to be believable.
 */
const cleanupQuietly = (directory: string): void => {
  for (let attempt = 0; attempt < 3; attempt++)
    try {
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
      return;
    } catch {
      // Retry, then give up: the OS releases these handles on its own schedule.
    }
};

const linkEvidencePackage = (modules: string): void => {
  const source: string = path.resolve(
    suiteRoot,
    "..",
    "..",
    "packages",
    "evidence",
  );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(source, "package.json"), "utf8"),
  ) as Record<string, unknown>;
  const publishConfig: unknown = manifest.publishConfig;
  if (
    typeof publishConfig !== "object" ||
    publishConfig === null ||
    Array.isArray(publishConfig)
  )
    throw new Error(
      "@samchon/lint-plugin-evidence must declare publishConfig before its consumer fixture can reproduce the published entry points.",
    );

  const destination: string = path.join(
    modules,
    "@samchon",
    "lint-plugin-evidence",
  );
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(
    path.join(destination, "package.json"),
    JSON.stringify(
      { ...manifest, ...(publishConfig as Record<string, unknown>) },
      null,
      2,
    ),
    "utf8",
  );
  for (const directory of ["lib", "native"]) {
    const target: string = path.join(source, directory);
    if (!fs.existsSync(target))
      throw new Error(
        `@samchon/lint-plugin-evidence ${directory} is missing; run the workspace build before the feature suite.`,
      );
    linkDirectory(target, path.join(destination, directory));
  }
};
