import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here: string = path.dirname(fileURLToPath(import.meta.url));
const suiteRoot: string = path.resolve(here, "..", "..");

export interface IEvidenceProject {
  readonly directory: string;
  cleanup(): void;
}

export interface ICreateProjectProps {
  /** Distinguishes temp directories in a failure report. */
  readonly name: string;
  /** File map, project-relative. Values are written verbatim. */
  readonly files: Readonly<Record<string, string>>;
  /** Complete `lint.config.ts` source, evaluated by the real config loader. */
  readonly lintConfig: string;
}

export interface IRunResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  /** Stdout and stderr joined, for substring assertions. */
  readonly output: string;
}

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
        },
        include: ["src", "lint.config.ts"],
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

/**
 * Runs `ttsc check` in the fixture and captures everything it said.
 *
 * The launcher script is invoked through `node` rather than through a shim on
 * PATH. `ttsc` publishes `bin: {"ttsc": "lib/launcher/ttsc.js"}` and has no
 * `bin/` directory, so probing for one and falling back to a bare `"ttsc"` only
 * works when something else — `npm run`, which injects `node_modules/.bin` —
 * happens to have prepared PATH. That made the suite pass for a reason it did
 * not state, and fail the moment it was driven any other way.
 */
export const runCheck = (directory: string): IRunResult => {
  const launcher: string = path.join(
    resolveDependency("ttsc"),
    "lib",
    "launcher",
    "ttsc.js",
  );
  const result: SpawnSyncReturns<string> = spawnSync(
    process.execPath,
    [launcher, "check", "-p", "tsconfig.json"],
    {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, TTSC_CACHE_DIR: cacheDirectory() },
      // Generous because the FIRST run of a cache key statically links this
      // package's Go into the lint binary, which ttsc itself warns "can take
      // several minutes on a cold Go cache" — measured at ~9 minutes here.
      timeout: 900_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const stdout: string = result.stdout ?? "";
  const stderr: string = result.stderr ?? "";
  return {
    status: result.status,
    stdout,
    stderr,
    output: `${stdout}${stderr}`,
  };
};

/**
 * Pins the ttsc plugin build cache to one suite-owned directory.
 *
 * The default location is `<workspaceRoot>/node_modules/.cache/ttsc`, and every
 * fixture here is a fresh temp directory with a fresh node_modules — so the
 * default makes every single case pay the ~9-minute cold Go link, and the suite
 * grows by nine minutes per test. Pointing every fixture at one stable cache
 * means the first case pays once and the rest are seconds.
 *
 * The cache is keyed by content (plugin source plus toolchain versions), so a
 * shared cache is not a stale-result risk: editing a rule changes the key and
 * the affected cases relink.
 */
const cacheDirectory = (): string => {
  const location: string = path.join(suiteRoot, ".cache", "ttsc");
  fs.mkdirSync(location, { recursive: true });
  return location;
};

const linkDirectory = (target: string, location: string): void => {
  if (fs.existsSync(location)) return;
  fs.symlinkSync(target, location, "junction");
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

const resolveDependency = (specifier: string): string => {
  // Walk up from the package.json rather than trusting a main entry: `ttsc`
  // resolves to a launcher, and what is needed here is the package root.
  const manifest: string = fileURLToPath(
    import.meta.resolve(`${specifier}/package.json`),
  );
  return path.dirname(manifest);
};

/** Fails with a message that shows what the toolchain actually printed. */
export const assertIncludes = (
  result: IRunResult,
  expected: string,
  because: string,
): void => {
  if (result.output.includes(expected)) return;
  throw new Error(
    `${because}\n\nExpected output to include:\n  ${expected}\n\nActual output:\n${result.output}`,
  );
};

export const assertExcludes = (
  result: IRunResult,
  forbidden: string,
  because: string,
): void => {
  if (!result.output.includes(forbidden)) return;
  throw new Error(
    `${because}\n\nExpected output NOT to include:\n  ${forbidden}\n\nActual output:\n${result.output}`,
  );
};

/** Fails when the real compiler exits with an unexpected status. */
export const assertStatus = (
  result: IRunResult,
  expected: number,
  because: string,
): void => {
  if (result.status === expected) return;
  throw new Error(
    `${because}\n\nExpected exit status: ${expected}\nActual exit status: ${String(result.status)}\n\nActual output:\n${result.output}`,
  );
};

/** Fails unless the compiler rejected the project with a real exit status. */
export const assertFailure = (result: IRunResult, because: string): void => {
  if (result.status !== null && result.status !== 0) return;
  throw new Error(
    `${because}\n\nExpected a non-zero exit status.\nActual exit status: ${String(result.status)}\n\nActual output:\n${result.output}`,
  );
};
