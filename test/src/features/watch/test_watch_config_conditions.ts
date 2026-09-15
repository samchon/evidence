import {
  EvidenceConfigDependencyScanner,
  EvidenceConfigLoader,
  type IEvidenceConfig,
  type IEvidenceSourceDependency,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Resolves static config dependencies with the mechanism used at runtime.
 *
 * Conditional exports can send identical package specifiers to different files.
 * The scanner must retain ESM/CommonJS context through local and transitive
 * modules or watch will observe an unused entry while the evaluator executes
 * another one.
 *
 * 1. Scan an ESM TypeScript config that combines:
 *
 *    - A static package import whose selected entry reexports another package.
 *    - MTS and CTS helpers with their own static package imports.
 *    - Literal dynamic `import()` and `require()` package requests.
 * 2. Require every import request, including the transitive reexport, to select
 *    its package's import entry and the CTS/require requests to select
 *    require.
 * 3. Require every unused opposite-condition entry to remain outside the watch
 *    set, proving that success does not come from observing whole packages.
 * 4. Require a package exposing only an import condition to resolve normally.
 * 5. Require a package selected by CommonJS whose `.js` entry belongs to an ESM
 *    package scope; verify Node and scanning use import for its nested
 *    request.
 * 6. Reach a physical ESM config through a CommonJS-scoped directory link; require
 *    evaluation and scanning to derive static import conditions from the
 *    physical package while retaining both sides of the link for watch.
 */
export async function test_watch_config_conditions(): Promise<void> {
  const location: string = join(__dirname, `config conditions ${randomUUID()}`);
  await EvidenceTestFileSystem.experiment(
    location,
    {
      "package.json": JSON.stringify({ type: "module" }),
      "evidence.config.ts": dedent`
        import "dual-entry";
        import "./require-helper.cts";
        export { default as imported } from "./import-helper.mts";

        void import("dynamic-entry");
        require("required-entry");
        export default { claims: [] };
      `,
      "require-helper.cts": `import "require-only";\nexport {};\n`,
      "import-helper.mts": `export { default } from "import-only";\n`,
      "node_modules/dual-entry/package.json": manifest(
        "./import.js",
        "./require.cjs",
      ),
      "node_modules/dual-entry/import.js": `export { default } from "transitive-entry";\n`,
      "node_modules/dual-entry/require.cjs": `module.exports = {};\n`,
      "node_modules/transitive-entry/package.json": manifest(
        "./import.js",
        "./require.cjs",
      ),
      "node_modules/transitive-entry/import.js": `export default {};\n`,
      "node_modules/transitive-entry/require.cjs": `module.exports = {};\n`,
      "node_modules/require-only/package.json": manifest(
        "./unused.js",
        "./selected.cjs",
      ),
      "node_modules/require-only/unused.js": `export default {};\n`,
      "node_modules/require-only/selected.cjs": `module.exports = {};\n`,
      "node_modules/import-only/package.json": JSON.stringify({
        type: "module",
        exports: { import: "./selected.js" },
      }),
      "node_modules/import-only/selected.js": `export default {};\n`,
      "node_modules/dynamic-entry/package.json": manifest(
        "./selected.js",
        "./unused.cjs",
      ),
      "node_modules/dynamic-entry/selected.js": `export default {};\n`,
      "node_modules/dynamic-entry/unused.cjs": `module.exports = {};\n`,
      "node_modules/required-entry/package.json": manifest(
        "./unused.js",
        "./selected.cjs",
      ),
      "node_modules/required-entry/unused.js": `export default {};\n`,
      "node_modules/required-entry/selected.cjs": `module.exports = {};\n`,
      "package-mode.cjs": `module.exports = require("outer-mode");\n`,
      "node_modules/outer-mode/package.json": JSON.stringify({
        type: "module",
        exports: { require: "./entry.js" },
      }),
      "node_modules/outer-mode/entry.js": `import value from "nested-mode"; export default value;\n`,
      "node_modules/nested-mode/package.json": manifest(
        "./import.js",
        "./require.cjs",
      ),
      "node_modules/nested-mode/import.js": `export default "import";\n`,
      "node_modules/nested-mode/require.cjs": `module.exports = "require";\n`,
    },
    async (directory: string): Promise<void> => {
      const dependencies: string[] = (
        await new EvidenceConfigDependencyScanner(
          join(directory, "evidence.config.ts"),
        ).scan()
      ).map((dependency: IEvidenceSourceDependency): string =>
        dependency.path.replaceAll("\\", "/"),
      );
      const relative: (file: string) => string = (file: string): string =>
        join(directory, file).replaceAll("\\", "/");
      const selected: string[] = [
        "node_modules/dual-entry/import.js",
        "node_modules/transitive-entry/import.js",
        "node_modules/require-only/selected.cjs",
        "node_modules/import-only/selected.js",
        "node_modules/dynamic-entry/selected.js",
        "node_modules/required-entry/selected.cjs",
      ];
      const unused: string[] = [
        "node_modules/dual-entry/require.cjs",
        "node_modules/transitive-entry/require.cjs",
        "node_modules/require-only/unused.js",
        "node_modules/dynamic-entry/unused.cjs",
        "node_modules/required-entry/unused.js",
      ];

      TestValidator.equals(
        "condition-selected config dependencies",
        selected.filter((file: string): boolean =>
          dependencies.includes(relative(file)),
        ),
        selected,
      );
      TestValidator.equals(
        "unused conditional entries",
        unused.filter((file: string): boolean =>
          dependencies.includes(relative(file)),
        ),
        [],
      );

      const packageModeFile: string = join(directory, "package-mode.cjs");
      const runtime: unknown = createRequire(packageModeFile)("outer-mode");
      if (typeof runtime !== "object" || runtime === null)
        throw new Error("Expected a CommonJS-visible ESM namespace object.");
      const namespace: Record<string, unknown> = runtime as Record<
        string,
        unknown
      >;
      TestValidator.equals(
        "runtime nested JavaScript package mode",
        namespace["default"],
        "import",
      );
      const packageModeDependencies: string[] = (
        await new EvidenceConfigDependencyScanner(packageModeFile).scan()
      ).map((dependency: IEvidenceSourceDependency): string =>
        dependency.path.replaceAll("\\", "/"),
      );
      TestValidator.predicate(
        "scanner nested JavaScript package mode",
        packageModeDependencies.includes(
          relative("node_modules/nested-mode/import.js"),
        ),
      );
      TestValidator.predicate(
        "scanner excludes opposite nested JavaScript package mode",
        !packageModeDependencies.includes(
          relative("node_modules/nested-mode/require.cjs"),
        ),
      );
    },
  );
  await EvidenceTestFileSystem.experiment(
    join(location, "physical config mode"),
    {
      "physical/package.json": JSON.stringify({ type: "module" }),
      "physical/config/evidence.config.ts": dedent`
        import severity from "physical-mode";

        export default {
          severity,
          claims: [{
            type: "markdown",
            files: ["rules.md"],
            reference: { type: "markdown", files: ["rules.md"] },
          }],
        };
      `,
      "physical/config/rules.md": `# Rule\n`,
      "physical/node_modules/physical-mode/package.json": JSON.stringify({
        exports: {
          types: "./index.d.ts",
          import: "./selected.mjs",
          require: "./selected.cjs",
        },
      }),
      "physical/node_modules/physical-mode/index.d.ts": `declare const value: "off" | "warning"; export default value;\n`,
      "physical/node_modules/physical-mode/selected.mjs": `export default "off";\n`,
      "physical/node_modules/physical-mode/selected.cjs": `module.exports = "warning";\n`,
      "logical/package.json": JSON.stringify({ type: "commonjs" }),
    },
    async (directory: string): Promise<void> => {
      const physicalDirectory: string = join(directory, "physical/config");
      const logicalDirectory: string = join(directory, "logical/config-link");
      await symlink(physicalDirectory, logicalDirectory, "junction");
      const configFile: string = join(logicalDirectory, "evidence.config.ts");
      const config: IEvidenceConfig =
        await EvidenceConfigLoader.load(configFile);
      TestValidator.equals(
        "physical config module mode",
        config.severity,
        "off",
      );

      const dependencies: string[] = (
        await new EvidenceConfigDependencyScanner(configFile).scan()
      ).map((dependency: IEvidenceSourceDependency): string =>
        dependency.path.replaceAll("\\", "/"),
      );
      const relative: (file: string) => string = (file: string): string =>
        join(directory, file).replaceAll("\\", "/");
      TestValidator.predicate(
        "physical import condition",
        dependencies.includes(
          relative("physical/node_modules/physical-mode/selected.mjs"),
        ),
      );
      TestValidator.predicate(
        "physical require condition excluded",
        !dependencies.includes(
          relative("physical/node_modules/physical-mode/selected.cjs"),
        ),
      );
      TestValidator.predicate(
        "logical config dependency retained",
        dependencies.includes(
          relative("logical/config-link/evidence.config.ts"),
        ),
      );
      TestValidator.predicate(
        "physical package boundary retained",
        dependencies.includes(relative("physical/package.json")),
      );
    },
  );
}

/**
 * Builds a package manifest with distinct import and require entries.
 *
 * Scenario mutations vary only the selected target so dependency comparisons
 * can attribute each observed file to the config module's loading mechanism.
 */
function manifest(importTarget: string, requireTarget: string): string {
  return JSON.stringify({
    type: "module",
    exports: {
      import: importTarget,
      require: requireTarget,
    },
  });
}
