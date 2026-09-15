import {
  EvidenceConfigDependencyScanner,
  EvidenceConfigLoader,
  EvidenceWatchDependencySnapshot,
  type IEvidenceConfig,
  type IEvidenceSourceDependency,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Follows runtime JavaScript files selected by legacy package resolution.
 *
 * TypeScript may use a same-stem `.ts` file while resolving types for a `.js`
 * package entry, but Node executes the manifest or subpath's JavaScript file.
 * Watch must observe the executed source rather than the compiler substitute.
 *
 * 1. Create a legacy package whose `main` names `entry.js`, plus a direct `sub.js`
 *    request, and place same-stem TypeScript files beside both.
 * 2. Give the JavaScript pair one configuration value and the TypeScript pair a
 *    different value, then require normal configuration loading to use
 *    JavaScript.
 * 3. Require dependency scanning to retain both JavaScript files and omit both
 *    same-stem TypeScript files.
 * 4. Edit an inactive TypeScript substitute and an active JavaScript entry,
 *    requiring only the executed entry to invalidate the dependency snapshot.
 * 5. Repoint `main` through extensionless and nested-directory index fallbacks and
 *    require evaluation and scanning to agree with each runtime selection.
 * 6. Put a package manifest under the terminal `index` directory and add a bare
 *    extensionless `index`; require both invalid forms to remain unselected.
 * 7. Evaluate and scan ESM configs with extensionless and explicit package
 *    subpaths; require only the exact `.js` request to succeed and be
 *    observed.
 * 8. Compare Node and scanning for CommonJS package files, empty nearer package
 *    directories, and normalized legacy requests, then require direct ESM to
 *    reject a scoped name with no package segment.
 * 9. Treat BOM-prefixed manifests and non-string `main` values like Node, then
 *    allow same-directory `main` targets to reach their terminal index files.
 */
export async function test_watch_package_runtime_entries(): Promise<void> {
  const location: string = join(
    __dirname,
    `watch package runtime entries ${randomUUID()}`,
  );
  await EvidenceTestFileSystem.experiment(
    location,
    {
      "package.json": JSON.stringify({ type: "commonjs" }),
      "evidence.config.ts": dedent`
        import root from "legacy-settings";
        import subpath from "legacy-settings/sub.js";

        export default {
          severity: root === subpath ? root : "error",
          claims: [
            {
              type: "markdown",
              files: ["rules.md"],
              reference: { type: "markdown", files: ["rules.md"] },
            },
          ],
        };
      `,
      "rules.md": `# Rule\n`,
      "node_modules/legacy-settings/package.json": JSON.stringify({
        main: "entry.js",
        types: "entry.ts",
      }),
      "node_modules/legacy-settings/entry.js": `module.exports = "warning";\n`,
      "node_modules/legacy-settings/entry.ts": `export default ("off" as "error" | "off");\n`,
      "node_modules/legacy-settings/sub.js": `module.exports = "warning";\n`,
      "node_modules/legacy-settings/sub.ts": `export default ("off" as "error" | "off");\n`,
      "node_modules/legacy-settings/nested/index.js": `module.exports = "warning";\n`,
      "recursive.cjs": `require("recursive-settings");\n`,
      "node_modules/recursive-settings/package.json": JSON.stringify({
        main: "nested",
      }),
      "node_modules/recursive-settings/nested/index/package.json":
        JSON.stringify({
          main: "deep.js",
        }),
      "node_modules/recursive-settings/nested/index/deep.js": `module.exports = {};\n`,
      "extensionless-index.cjs": `require("extensionless-index");\n`,
      "node_modules/extensionless-index/index": `module.exports = {};\n`,
      "esm-extensionless.config.mts": dedent`
        import severity from "esm-legacy/sub";
        export default {
          severity,
          claims: [{
            type: "markdown",
            files: ["rules.md"],
            reference: { type: "markdown", files: ["rules.md"] },
          }],
        };
      `,
      "esm-explicit.config.mts": dedent`
        import severity from "esm-legacy/sub.js";
        export default {
          severity,
          claims: [{
            type: "markdown",
            files: ["rules.md"],
            reference: { type: "markdown", files: ["rules.md"] },
          }],
        };
      `,
      "node_modules/esm-legacy/package.json": JSON.stringify({
        type: "module",
      }),
      "node_modules/esm-legacy/sub.js": `export default "warning";\n`,
      "node_modules/esm-legacy/sub.d.ts": `declare const value: "warning"; export default value;\n`,
      "commonjs-file.cjs": `console.log(require("file-entry"));\n`,
      "node_modules/file-entry.js": `module.exports = "file entry";\n`,
      "nested/commonjs-fallback.cjs": `console.log(require("fallback-entry"));\n`,
      "nested/node_modules/fallback-entry/.keep": ``,
      "node_modules/fallback-entry/index.js": `module.exports = "ancestor entry";\n`,
      "commonjs-normalized.cjs": `console.log(require("absent/../../outside"));\n`,
      "outside.js": `module.exports = "normalized entry";\n`,
      "esm-invalid-scope.mjs": `import "@invalid";\n`,
      "node_modules/@invalid/index.js": `module.exports = {};\n`,
      "coerced-main.cjs": `require("coerced-main");\n`,
      "node_modules/coerced-main/package.json": JSON.stringify({ main: null }),
      "node_modules/coerced-main/index.js": `module.exports = "selected";\n`,
      "dot-main.cjs": `console.log(require("dot-main/nested"));\n`,
      "node_modules/dot-main/package.json": `{}`,
      "node_modules/dot-main/nested/package.json": JSON.stringify({
        main: ".",
      }),
      "node_modules/dot-main/nested/index.js": `module.exports = "dot index";\n`,
    },
    async (directory: string): Promise<void> => {
      const configFile: string = join(directory, "evidence.config.ts");
      const config: IEvidenceConfig = await EvidenceConfigLoader.load(configFile);
      TestValidator.equals(
        "legacy runtime severity",
        config.severity,
        "warning",
      );

      const dependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(configFile).scan();
      const paths: string[] = dependencies.map(
        (dependency: IEvidenceSourceDependency): string =>
          dependency.path.replaceAll("\\", "/"),
      );
      const selected: string[] = ["entry.js", "sub.js"];
      const substitutes: string[] = ["entry.ts", "sub.ts"];
      TestValidator.equals(
        "legacy runtime entries",
        selected.filter((file: string): boolean =>
          paths.includes(
            join(directory, "node_modules/legacy-settings", file).replaceAll(
              "\\",
              "/",
            ),
          ),
        ),
        selected,
      );
      TestValidator.equals(
        "compiler substitutes excluded",
        substitutes.filter((file: string): boolean =>
          paths.includes(
            join(directory, "node_modules/legacy-settings", file).replaceAll(
              "\\",
              "/",
            ),
          ),
        ),
        [],
      );

      const baseline: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(dependencies);
      await EvidenceTestFileSystem.save(directory, {
        "node_modules/legacy-settings/entry.ts": `export default ("error" as "error" | "off");\n`,
      });
      const inactiveEdit: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(dependencies);
      TestValidator.predicate(
        "compiler substitute edit remains stable",
        baseline.equals(inactiveEdit),
      );
      await EvidenceTestFileSystem.save(directory, {
        "node_modules/legacy-settings/entry.js": `module.exports = "warning"; // active edit\n`,
      });
      const activeEdit: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(dependencies);
      TestValidator.predicate(
        "runtime entry edit invalidates snapshot",
        !baseline.equals(activeEdit),
      );

      await EvidenceTestFileSystem.save(directory, {
        "node_modules/legacy-settings/package.json": JSON.stringify({
          main: "entry",
          types: "entry.ts",
        }),
      });
      const extensionlessConfig: IEvidenceConfig =
        await EvidenceConfigLoader.load(configFile);
      TestValidator.equals(
        "extensionless main severity",
        extensionlessConfig.severity,
        "warning",
      );
      const extensionless: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(configFile).scan();
      TestValidator.predicate(
        "extensionless main runtime entry",
        dependencyPaths(extensionless).includes(
          join(directory, "node_modules/legacy-settings/entry.js").replaceAll(
            "\\",
            "/",
          ),
        ),
      );

      await EvidenceTestFileSystem.save(directory, {
        "node_modules/legacy-settings/package.json": JSON.stringify({
          main: "nested",
          types: "entry.ts",
        }),
      });
      const directoryConfig: IEvidenceConfig =
        await EvidenceConfigLoader.load(configFile);
      TestValidator.equals(
        "directory main severity",
        directoryConfig.severity,
        "warning",
      );
      const directoryEntry: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(configFile).scan();
      TestValidator.predicate(
        "directory main runtime entry",
        dependencyPaths(directoryEntry).includes(
          join(
            directory,
            "node_modules/legacy-settings/nested/index.js",
          ).replaceAll("\\", "/"),
        ),
      );

      // A terminal index probe checks files only; reading another manifest here
      // would let watch accept a package that the evaluator cannot execute.
      const recursiveFile: string = join(directory, "recursive.cjs");
      let runtimeRejected: boolean = false;
      try {
        createRequire(recursiveFile)("recursive-settings");
      } catch {
        runtimeRejected = true;
      }
      TestValidator.predicate(
        "runtime rejects recursive index package",
        runtimeRejected,
      );
      const recursiveScanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(recursiveFile);
      let scannerRejected: boolean = false;
      try {
        await recursiveScanner.scan();
      } catch {
        scannerRejected = true;
      }
      TestValidator.predicate(
        "scanner rejects recursive index package",
        scannerRejected,
      );
      TestValidator.predicate(
        "recursive index target excluded",
        !dependencyPaths(recursiveScanner.list()).includes(
          join(
            directory,
            "node_modules/recursive-settings/nested/index/deep.js",
          ).replaceAll("\\", "/"),
        ),
      );

      const bareIndexFile: string = join(directory, "extensionless-index.cjs");
      TestValidator.error(
        "Node rejects extensionless terminal index",
        (): unknown => createRequire(bareIndexFile)("extensionless-index"),
      );
      const bareIndexScanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(bareIndexFile);
      await TestValidator.error(
        "scanner rejects extensionless terminal index",
        async (): Promise<void> => {
          await bareIndexScanner.scan();
        },
      );
      TestValidator.equals(
        "extensionless terminal index excluded",
        dependencyPaths(bareIndexScanner.list()).includes(
          join(directory, "node_modules/extensionless-index/index").replaceAll(
            "\\",
            "/",
          ),
        ),
        false,
      );

      const extensionlessEsm: string = join(
        directory,
        "esm-extensionless.config.mts",
      );
      let evaluatorRejectedEsm: boolean = false;
      try {
        await EvidenceConfigLoader.load(extensionlessEsm);
      } catch {
        evaluatorRejectedEsm = true;
      }
      TestValidator.predicate(
        "evaluator rejects extensionless ESM package subpath",
        evaluatorRejectedEsm,
      );
      const extensionlessScanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(extensionlessEsm);
      let scannerRejectedEsm: boolean = false;
      try {
        await extensionlessScanner.scan();
      } catch {
        scannerRejectedEsm = true;
      }
      TestValidator.predicate(
        "scanner rejects extensionless ESM package subpath",
        scannerRejectedEsm,
      );

      const explicitEsm: string = join(directory, "esm-explicit.config.mts");
      const explicitConfig: IEvidenceConfig =
        await EvidenceConfigLoader.load(explicitEsm);
      TestValidator.equals(
        "explicit ESM package subpath severity",
        explicitConfig.severity,
        "warning",
      );
      const explicitDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(explicitEsm).scan();
      TestValidator.predicate(
        "explicit ESM package subpath observed",
        dependencyPaths(explicitDependencies).includes(
          join(directory, "node_modules/esm-legacy/sub.js").replaceAll(
            "\\",
            "/",
          ),
        ),
      );

      const commonJsCases: ReadonlyArray<readonly [string, string, string]> = [
        ["commonjs-file.cjs", "file entry", "node_modules/file-entry.js"],
        [
          "nested/commonjs-fallback.cjs",
          "ancestor entry",
          "node_modules/fallback-entry/index.js",
        ],
        ["commonjs-normalized.cjs", "normalized entry", "outside.js"],
      ];
      for (const [owner, expectedOutput, selectedFile] of commonJsCases) {
        const ownerFile: string = join(directory, owner);
        TestValidator.equals(
          `${owner} Node selection`,
          execFileSync(process.execPath, [ownerFile], {
            encoding: "utf8",
          }).trim(),
          expectedOutput,
        );
        const selectedDependencies: IEvidenceSourceDependency[] =
          await new EvidenceConfigDependencyScanner(ownerFile).scan();
        TestValidator.predicate(
          `${owner} scanner selection`,
          dependencyPaths(selectedDependencies).includes(
            join(directory, selectedFile).replaceAll("\\", "/"),
          ),
        );
      }

      const invalidScopeFile: string = join(directory, "esm-invalid-scope.mjs");
      let nodeRejectedScope: boolean = false;
      try {
        execFileSync(process.execPath, [invalidScopeFile], {
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch {
        nodeRejectedScope = true;
      }
      TestValidator.predicate(
        "Node rejects incomplete ESM scope",
        nodeRejectedScope,
      );
      const invalidScopeScanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(invalidScopeFile);
      let scannerRejectedScope: boolean = false;
      try {
        await invalidScopeScanner.scan();
      } catch {
        scannerRejectedScope = true;
      }
      TestValidator.predicate(
        "scanner rejects incomplete ESM scope",
        scannerRejectedScope,
      );
      TestValidator.predicate(
        "invalid ESM scope entry excluded",
        !dependencyPaths(invalidScopeScanner.list()).includes(
          join(directory, "node_modules/@invalid/index.js").replaceAll(
            "\\",
            "/",
          ),
        ),
      );

      const coercedOwner: string = join(directory, "coerced-main.cjs");
      const coercedIndex: string = join(
        directory,
        "node_modules/coerced-main/index.js",
      ).replaceAll("\\", "/");
      const legacyMainCases: ReadonlyArray<readonly [string, unknown]> = [
        ["null", null],
        ["false", false],
        ["zero", 0],
        ["object", {}],
      ];
      for (const [label, main] of legacyMainCases) {
        await EvidenceTestFileSystem.save(directory, {
          "node_modules/coerced-main/package.json": JSON.stringify({ main }),
        });
        TestValidator.equals(
          `${label} main Node selection`,
          createRequire(coercedOwner)
            .resolve("coerced-main")
            .replaceAll("\\", "/"),
          coercedIndex,
        );
        const selected: IEvidenceSourceDependency[] =
          await new EvidenceConfigDependencyScanner(coercedOwner).scan();
        TestValidator.predicate(
          `${label} main scanner selection`,
          dependencyPaths(selected).includes(coercedIndex),
        );
      }
      await EvidenceTestFileSystem.save(directory, {
        "node_modules/coerced-main/package.json": `\uFEFF${JSON.stringify({ main: null })}`,
      });
      TestValidator.equals(
        "BOM manifest Node selection",
        createRequire(coercedOwner)
          .resolve("coerced-main")
          .replaceAll("\\", "/"),
        coercedIndex,
      );
      const bomDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(coercedOwner).scan();
      TestValidator.predicate(
        "BOM manifest scanner selection",
        dependencyPaths(bomDependencies).includes(coercedIndex),
      );
      const bomSnapshot: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(bomDependencies);
      await EvidenceTestFileSystem.save(directory, {
        "node_modules/coerced-main/index.js": `module.exports = "edited";\n`,
      });
      const editedIndex: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(bomDependencies);
      TestValidator.predicate(
        "coerced main index edit invalidates snapshot",
        !bomSnapshot.equals(editedIndex),
      );

      const dotOwner: string = join(directory, "dot-main.cjs");
      const dotIndex: string = join(
        directory,
        "node_modules/dot-main/nested/index.js",
      ).replaceAll("\\", "/");
      const dotMains: string[] = [".", "./", "./child/.."];
      for (const main of dotMains) {
        await EvidenceTestFileSystem.save(directory, {
          "node_modules/dot-main/nested/package.json": JSON.stringify({ main }),
        });
        TestValidator.equals(
          `${main} main Node output`,
          execFileSync(process.execPath, [dotOwner], {
            encoding: "utf8",
          }).trim(),
          "dot index",
        );
        const selected: IEvidenceSourceDependency[] =
          await new EvidenceConfigDependencyScanner(dotOwner).scan();
        TestValidator.predicate(
          `${main} main scanner index`,
          dependencyPaths(selected).includes(dotIndex),
        );
      }
    },
  );
}

/**
 * Normalizes dependency paths for platform-independent fixture assertions.
 *
 * Watch records retain native paths; slash normalization keeps expected values
 * stable on Windows and POSIX runners.
 */
function dependencyPaths(dependencies: IEvidenceSourceDependency[]): string[] {
  return dependencies.map((dependency: IEvidenceSourceDependency): string =>
    dependency.path.replaceAll("\\", "/"),
  );
}
