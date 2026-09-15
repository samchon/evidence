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
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Resolves package imports and self-references used by a TypeScript config.
 *
 * Node resolves both forms through the nearest package manifest rather than a
 * `node_modules` lookup. Watch must select the same conditional targets as the
 * evaluator and exclude entries from the inactive condition.
 *
 * 1. Create a CommonJS package scope with a conditional `#settings` import map, an
 *    external-package redirect, and a conditional export for its own name.
 * 2. Load a config that imports both forms and require their runtime values to
 *    reach the validated configuration.
 * 3. Scan the same config and require both CommonJS targets and the governing
 *    package manifest to enter the dependency set.
 * 4. Switch the package scope to ESM and require evaluation and scanning to use
 *    the import targets while removing the prior CommonJS targets.
 * 5. Repoint one map to a missing file, retain that target through failure, and
 *    require file creation to invalidate the failed dependency snapshot.
 * 6. Require arrays to skip invalid, primitive, and null targets before selecting
 *    their next valid entries, while an exhausted nested array remains
 *    blocked.
 * 7. Reject malformed and package-escaping maps while retaining the manifest, then
 *    reject an integer condition key that Node cannot order as authored.
 * 8. Reject an external map target whose scoped package name is incomplete,
 *    matching Node even when a loadable scope-directory index exists.
 * 9. Ignore malformed unrelated import-map keys while resolving a valid key, but
 *    reject internal and strict bare-package requests ending in `/` like Node.
 * 10. Normalize dot segments in direct ESM subpaths and external-package wildcard
 *     redirects, then require the executed targets to enter watch
 *     dependencies.
 * 11. Restore the map and require scanning to recover in the same process.
 * 12. Redirect CJS and ESM owners from a root import map while a nested package
 *     shadows the same name; require Node and watch to select the root entries,
 *     with only edits to those executed entries invalidating their snapshots.
 */
export async function test_watch_package_maps(): Promise<void> {
  const location: string = join(
    __dirname,
    `watch package maps ${randomUUID()}`,
  );
  await EvidenceTestFileSystem.experiment(
    location,
    {
      "package.json": packageManifest("commonjs"),
      "evidence.config.ts": dedent`
        import internal from "#settings";
        import external from "#external";
        import self from "fixture-config";

        export default {
          severity: internal === self && self === external ? internal : "error",
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
      "escape.mjs": dedent`
        import selected from "#wild/../../victim.mjs?mapped=1#selected";
        console.log(selected);
      `,
      "direct-normalized.mjs": dedent`
        import selected from "normalized-package/foo/../bar.mjs?direct=1#selected";
        console.log(selected);
      `,
      "encoded-separator.mjs": `import "normalized-package/foo%2fbar.mjs";\n`,
      "invalid-scope.cjs": `require("#invalid-scope");\n`,
      "valid-key.mjs": `import value from "#valid"; console.log(value);\n`,
      "nullable-map.mjs": dedent`
        import internal from "#settings";
        import external from "#external";
        import self from "fixture-config";
        console.log([internal, external, self].join(","));
      `,
      "trailing-key.mjs": `import "#trailing/";\n`,
      "trailing-package.mjs": `import "trailing-package/";\n`,
      "victim.mjs": `export default "mapped";\n`,
      "internal.cjs": `module.exports = "warning";\n`,
      "internal.d.cts": `declare const value: "warning"; export = value;\n`,
      "self.cjs": `module.exports = "warning";\n`,
      "self.d.cts": `declare const value: "warning"; export = value;\n`,
      "unused-internal.mjs": `export default "off";\n`,
      "unused-self.mjs": `export default "off";\n`,
      "node_modules/mapped-package/package.json": JSON.stringify({
        exports: {
          import: "./selected.mjs",
          require: "./selected.cjs",
        },
      }),
      "node_modules/mapped-package/selected.mjs": `export default "off";\n`,
      "node_modules/mapped-package/selected.d.mts": `declare const value: "off"; export default value;\n`,
      "node_modules/mapped-package/selected.cjs": `module.exports = "warning";\n`,
      "node_modules/mapped-package/selected.d.cts": `declare const value: "warning"; export = value;\n`,
      "node_modules/@invalid-scope/index.js": `module.exports = {};\n`,
      "node_modules/normalized-package/package.json": JSON.stringify({
        name: "normalized-package",
      }),
      "node_modules/normalized-package/bar.mjs": `export default "direct";\n`,
      "node_modules/traversal-anchor/package.json": JSON.stringify({
        name: "traversal-anchor",
      }),
      "node_modules/trailing-package/package.json": JSON.stringify({
        type: "module",
        exports: { "./": "./unreachable.mjs" },
      }),
      "node_modules/trailing-package/unreachable.mjs": `export default "unreachable";\n`,
    },
    async (directory: string): Promise<void> => {
      const configFile: string = join(directory, "evidence.config.ts");
      const config: IEvidenceConfig = await EvidenceConfigLoader.load(configFile);
      TestValidator.equals(
        "package-map config severity",
        config.severity,
        "warning",
      );

      const dependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(configFile).scan();
      const paths: string[] = dependencies.map(
        (dependency: IEvidenceSourceDependency): string =>
          dependency.path.replaceAll("\\", "/"),
      );
      const expected: string[] = [
        "package.json",
        "internal.cjs",
        "self.cjs",
        "node_modules/mapped-package/selected.cjs",
      ].map((file: string): string =>
        join(directory, file).replaceAll("\\", "/"),
      );
      const unused: string[] = [
        "unused-internal.mjs",
        "unused-self.mjs",
        "node_modules/mapped-package/selected.mjs",
      ].map((file: string): string =>
        join(directory, file).replaceAll("\\", "/"),
      );
      TestValidator.equals(
        "package-map selected dependencies",
        expected.filter((file: string): boolean => paths.includes(file)),
        expected,
      );
      TestValidator.equals(
        "package-map unused conditions",
        unused.filter((file: string): boolean => paths.includes(file)),
        [],
      );

      const commonSnapshot: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(dependencies);
      await EvidenceTestFileSystem.save(directory, {
        "package.json": packageManifest("module"),
      });
      const changedScope: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(dependencies);
      TestValidator.predicate(
        "package-map mode invalidates snapshot",
        !commonSnapshot.equals(changedScope),
      );
      const esmConfig: IEvidenceConfig = await EvidenceConfigLoader.load(configFile);
      TestValidator.equals(
        "ESM package-map severity",
        esmConfig.severity,
        "off",
      );
      const esmDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(configFile).scan();
      const esmPaths: string[] = dependencyPaths(esmDependencies);
      TestValidator.equals(
        "ESM package-map targets",
        [
          "unused-internal.mjs",
          "unused-self.mjs",
          "node_modules/mapped-package/selected.mjs",
        ].filter((file: string): boolean =>
          esmPaths.includes(join(directory, file).replaceAll("\\", "/")),
        ),
        [
          "unused-internal.mjs",
          "unused-self.mjs",
          "node_modules/mapped-package/selected.mjs",
        ],
      );
      TestValidator.equals(
        "obsolete CommonJS package-map targets",
        ["internal.cjs", "self.cjs"].filter((file: string): boolean =>
          esmPaths.includes(join(directory, file).replaceAll("\\", "/")),
        ),
        [],
      );

      await EvidenceTestFileSystem.save(directory, {
        "package.json": packageManifest("module", "./missing.mjs"),
      });
      const missingScanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(configFile);
      const missingFailure: string = await scanFailure(missingScanner);
      TestValidator.predicate(
        "missing package-map target fails",
        missingFailure.includes("#settings"),
      );
      const failedDependencies: IEvidenceSourceDependency[] = missingScanner.list();
      const missingFile: string = join(directory, "missing.mjs").replaceAll(
        "\\",
        "/",
      );
      TestValidator.predicate(
        "missing package-map target retained",
        dependencyPaths(failedDependencies).includes(missingFile),
      );
      const missingSnapshot: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(failedDependencies);
      await EvidenceTestFileSystem.save(directory, {
        "missing.mjs": `export default "off";\n`,
      });
      const repairedSnapshot: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(failedDependencies);
      TestValidator.predicate(
        "package-map target creation invalidates snapshot",
        !missingSnapshot.equals(repairedSnapshot),
      );
      await new EvidenceConfigDependencyScanner(configFile).scan();

      await EvidenceTestFileSystem.save(directory, {
        "package.json": packageManifest("module", [
          "../invalid.mjs",
          42,
          "./unused-internal.mjs",
        ]),
      });
      const arrayConfig: IEvidenceConfig = await EvidenceConfigLoader.load(configFile);
      TestValidator.equals(
        "package-map array severity",
        arrayConfig.severity,
        "off",
      );
      const arrayDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(configFile).scan();
      TestValidator.predicate(
        "package-map array fallback",
        dependencyPaths(arrayDependencies).includes(
          join(directory, "unused-internal.mjs").replaceAll("\\", "/"),
        ),
      );

      await EvidenceTestFileSystem.save(directory, {
        "package.json": nullableFallbackManifest(),
      });
      const nullableFile: string = join(directory, "nullable-map.mjs");
      TestValidator.equals(
        "Node selects nullable package-map fallbacks",
        execFileSync(process.execPath, [nullableFile], {
          encoding: "utf8",
        }).trim(),
        "off,off,off",
      );
      const nullableDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(nullableFile).scan();
      const nullablePaths: string[] = dependencyPaths(nullableDependencies);
      const nullableFiles: string[] = [
        "unused-internal.mjs",
        "unused-self.mjs",
        "node_modules/mapped-package/selected.mjs",
      ];
      for (const file of nullableFiles)
        TestValidator.predicate(
          `nullable package-map selects ${file}`,
          nullablePaths.includes(join(directory, file).replaceAll("\\", "/")),
        );

      const blockedTargets: unknown[] = [null, [null]];
      for (const blockedTarget of blockedTargets) {
        await EvidenceTestFileSystem.save(directory, {
          "package.json": packageManifest("module", blockedTarget),
        });
        const blockedScanner: EvidenceConfigDependencyScanner =
          new EvidenceConfigDependencyScanner(nullableFile);
        await scanFailure(blockedScanner);
        TestValidator.predicate(
          "null-only package target remains unavailable",
          dependencyPaths(blockedScanner.list()).includes(
            join(directory, "package.json").replaceAll("\\", "/"),
          ),
        );
      }

      const blockedArrays: ReadonlyArray<readonly [unknown[], boolean]> = [
        [[], false],
        [[null], false],
        [[42, null], false],
        [[null, 42], true],
      ];
      for (const [target, invalid] of blockedArrays) {
        await EvidenceTestFileSystem.save(directory, {
          "package.json": packageManifest("module", {
            import: target,
            default: "./unused-internal.mjs",
          }),
        });
        let nodeRejectedNestedArray: boolean = false;
        try {
          execFileSync(process.execPath, [nullableFile], {
            stdio: ["ignore", "pipe", "ignore"],
          });
        } catch {
          nodeRejectedNestedArray = true;
        }
        TestValidator.predicate(
          "Node keeps an exhausted nested array blocked",
          nodeRejectedNestedArray,
        );
        const nestedScanner: EvidenceConfigDependencyScanner =
          new EvidenceConfigDependencyScanner(nullableFile);
        const nestedFailure: string = await scanFailure(nestedScanner);
        TestValidator.equals(
          "scanner preserves final invalid-target state",
          nestedFailure.includes(
            "Package export targets must be strings, arrays, or objects.",
          ),
          invalid,
        );
        TestValidator.predicate(
          "scanner keeps an exhausted nested array blocked",
          !dependencyPaths(nestedScanner.list()).includes(
            join(directory, "unused-internal.mjs").replaceAll("\\", "/"),
          ),
        );
      }

      await EvidenceTestFileSystem.save(directory, {
        "package.json": packageManifest("module", {
          import: [{ browser: "./missing.mjs" }],
          default: "./unused-internal.mjs",
        }),
      });
      TestValidator.equals(
        "Node skips an unresolved nested array",
        execFileSync(process.execPath, [nullableFile], {
          encoding: "utf8",
        }).trim(),
        "off,off,off",
      );
      const unresolvedArray: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(nullableFile).scan();
      TestValidator.predicate(
        "scanner skips an unresolved nested array",
        dependencyPaths(unresolvedArray).includes(
          join(directory, "unused-internal.mjs").replaceAll("\\", "/"),
        ),
      );

      await EvidenceTestFileSystem.save(directory, {
        "package.json": JSON.stringify({
          name: "fixture-config",
          type: "module",
          imports: [],
          exports: "./unused-self.mjs",
        }),
      });
      const malformedScanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(configFile);
      await scanFailure(malformedScanner);
      TestValidator.predicate(
        "malformed package map retains manifest",
        dependencyPaths(malformedScanner.list()).includes(
          join(directory, "package.json").replaceAll("\\", "/"),
        ),
      );

      await EvidenceTestFileSystem.save(directory, {
        "package.json": packageManifest("module", "./%2e%2e/outside.mjs"),
      });
      const escapingScanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(configFile);
      const escapingFailure: string = await scanFailure(escapingScanner);
      TestValidator.predicate(
        "escaping package-map target rejected",
        escapingFailure.includes("#settings"),
      );

      await EvidenceTestFileSystem.save(directory, {
        "package.json": JSON.stringify({
          name: "fixture-config",
          type: "module",
          imports: {
            "#settings": [
              {
                0: "./missing.mjs",
                default: "./unused-internal.mjs",
              },
              "./unused-internal.mjs",
            ],
            "#external": "mapped-package",
          },
          exports: "./unused-self.mjs",
        }),
      });
      const numericScanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(configFile);
      const numericFailure: string = await scanFailure(numericScanner);
      TestValidator.predicate(
        "numeric package condition rejected",
        numericFailure.includes("integer property key"),
      );
      TestValidator.predicate(
        "numeric condition failure retains manifest",
        dependencyPaths(numericScanner.list()).includes(
          join(directory, "package.json").replaceAll("\\", "/"),
        ),
      );

      await EvidenceTestFileSystem.save(directory, {
        "package.json": JSON.stringify({
          type: "module",
          imports: {
            "#": "./victim.js",
            "#/bad": "./victim.js",
            "*": "./victim.js",
            "#valid": "./unused-internal.mjs",
            "#trailing/": "./unused-internal.mjs",
          },
        }),
      });
      const validKeyFile: string = join(directory, "valid-key.mjs");
      TestValidator.equals(
        "Node ignores unrelated invalid import keys",
        execFileSync(process.execPath, [validKeyFile], {
          encoding: "utf8",
        }).trim(),
        "off",
      );
      const validKeyDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(validKeyFile).scan();
      TestValidator.predicate(
        "scanner ignores unrelated invalid import keys",
        dependencyPaths(validKeyDependencies).includes(
          join(directory, "unused-internal.mjs").replaceAll("\\", "/"),
        ),
      );

      const trailingKeyFile: string = join(directory, "trailing-key.mjs");
      let nodeRejectedTrailingKey: boolean = false;
      try {
        execFileSync(process.execPath, [trailingKeyFile], {
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch {
        nodeRejectedTrailingKey = true;
      }
      TestValidator.predicate(
        "Node rejects trailing-slash import name",
        nodeRejectedTrailingKey,
      );
      const trailingKeyScanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(trailingKeyFile);
      const trailingKeyFailure: string = await scanFailure(trailingKeyScanner);
      TestValidator.predicate(
        "scanner rejects trailing-slash import name",
        trailingKeyFailure.includes("Invalid package import specifier"),
      );

      const trailingPackageFile: string = join(
        directory,
        "trailing-package.mjs",
      );
      let nodeRejectedTrailingPackage: boolean = false;
      try {
        execFileSync(process.execPath, [trailingPackageFile], {
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch {
        nodeRejectedTrailingPackage = true;
      }
      TestValidator.predicate(
        "Node rejects trailing-slash package request",
        nodeRejectedTrailingPackage,
      );
      const trailingPackageScanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(trailingPackageFile);
      const trailingPackageFailure: string = await scanFailure(
        trailingPackageScanner,
      );
      TestValidator.predicate(
        "scanner rejects trailing-slash package request",
        trailingPackageFailure.includes("invalid subpath"),
      );
      TestValidator.predicate(
        "trailing-slash package target excluded",
        !dependencyPaths(trailingPackageScanner.list()).includes(
          join(
            directory,
            "node_modules/trailing-package/unreachable.mjs",
          ).replaceAll("\\", "/"),
        ),
      );

      await EvidenceTestFileSystem.save(directory, {
        "package.json": JSON.stringify({
          imports: { "#invalid-scope": "@invalid-scope" },
        }),
      });
      const invalidScopeFile: string = join(directory, "invalid-scope.cjs");
      let nodeRejectedScope: boolean = false;
      try {
        execFileSync(process.execPath, [invalidScopeFile], {
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch {
        nodeRejectedScope = true;
      }
      TestValidator.predicate(
        "Node rejects mapped incomplete scope",
        nodeRejectedScope,
      );
      const invalidScopeScanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(invalidScopeFile);
      const invalidScopeFailure: string =
        await scanFailure(invalidScopeScanner);
      TestValidator.predicate(
        "scanner rejects mapped incomplete scope",
        invalidScopeFailure.includes("invalid name"),
      );
      TestValidator.predicate(
        "mapped invalid scope entry excluded",
        !dependencyPaths(invalidScopeScanner.list()).includes(
          join(directory, "node_modules/@invalid-scope/index.js").replaceAll(
            "\\",
            "/",
          ),
        ),
      );

      await EvidenceTestFileSystem.save(directory, {
        "package.json": JSON.stringify({
          imports: { "#wild/*": "traversal-anchor/*" },
        }),
      });
      const directFile: string = join(directory, "direct-normalized.mjs");
      TestValidator.equals(
        "Node normalizes direct ESM package subpaths",
        execFileSync(process.execPath, [directFile], {
          encoding: "utf8",
        }).trim(),
        "direct",
      );
      const directDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(directFile).scan();
      TestValidator.predicate(
        "scanner follows direct ESM package normalization",
        dependencyPaths(directDependencies).includes(
          join(directory, "node_modules/normalized-package/bar.mjs").replaceAll(
            "\\",
            "/",
          ),
        ),
      );

      const encodedFile: string = join(directory, "encoded-separator.mjs");
      const encodedScanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(encodedFile);
      const encodedFailure: string = await scanFailure(encodedScanner);
      TestValidator.predicate(
        "scanner rejects encoded package separators",
        encodedFailure.includes("encoded separator"),
      );

      const wildcardFile: string = join(directory, "escape.mjs");
      TestValidator.equals(
        "Node normalizes an external package-map redirect",
        execFileSync(process.execPath, [wildcardFile], {
          encoding: "utf8",
        }).trim(),
        "mapped",
      );
      const wildcardScanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(wildcardFile);
      const wildcardDependencies: IEvidenceSourceDependency[] =
        await wildcardScanner.scan();
      const victim: string = join(directory, "victim.mjs").replaceAll(
        "\\",
        "/",
      );
      TestValidator.predicate(
        "scanner follows external package-map normalization",
        dependencyPaths(wildcardDependencies).includes(victim),
      );
      const wildcardSnapshot: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(wildcardDependencies);
      await EvidenceTestFileSystem.save(directory, {
        "victim.mjs": `export default "edited mapped";\n`,
      });
      const wildcardAfterEdit: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(wildcardDependencies);
      TestValidator.predicate(
        "normalized package-map target invalidates snapshot",
        !wildcardSnapshot.equals(wildcardAfterEdit),
      );

      await EvidenceTestFileSystem.save(directory, {
        "package.json": packageManifest("module"),
      });
      const restored: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(configFile).scan();
      TestValidator.predicate(
        "restored package map resolves",
        dependencyPaths(restored).includes(
          join(directory, "unused-internal.mjs").replaceAll("\\", "/"),
        ),
      );
    },
  );
  await EvidenceTestFileSystem.experiment(
    join(location, "redirect scope"),
    {
      "package.json": JSON.stringify({
        type: "module",
        imports: { "#redirect": "redirected-package" },
      }),
      "src/common.cjs": `console.log(require("#redirect"));\n`,
      "src/module.mjs": dedent`
        import selected from "#redirect";
        console.log(selected);
      `,
      "node_modules/redirected-package/package.json": JSON.stringify({
        exports: {
          import: "./root.mjs",
          require: "./root.cjs",
        },
      }),
      "node_modules/redirected-package/root.cjs": `module.exports = "root require";\n`,
      "node_modules/redirected-package/root.mjs": `export default "root import";\n`,
      "src/node_modules/redirected-package/package.json": JSON.stringify({
        exports: {
          import: "./shadow.mjs",
          require: "./shadow.cjs",
        },
      }),
      "src/node_modules/redirected-package/shadow.cjs": `module.exports = "shadow require";\n`,
      "src/node_modules/redirected-package/shadow.mjs": `export default "shadow import";\n`,
    },
    async (directory: string): Promise<void> => {
      const commonFile: string = join(directory, "src/common.cjs");
      const moduleFile: string = join(directory, "src/module.mjs");
      TestValidator.equals(
        "Node CommonJS import-map scope",
        execFileSync(process.execPath, [commonFile], {
          encoding: "utf8",
        }).trim(),
        "root require",
      );
      TestValidator.equals(
        "Node ESM import-map scope",
        execFileSync(process.execPath, [moduleFile], {
          encoding: "utf8",
        }).trim(),
        "root import",
      );

      const commonDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(commonFile).scan();
      const moduleDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(moduleFile).scan();
      const commonPaths: string[] = dependencyPaths(commonDependencies);
      const modulePaths: string[] = dependencyPaths(moduleDependencies);
      const rootCommon: string = join(
        directory,
        "node_modules/redirected-package/root.cjs",
      ).replaceAll("\\", "/");
      const rootModule: string = join(
        directory,
        "node_modules/redirected-package/root.mjs",
      ).replaceAll("\\", "/");
      const shadowCommon: string = join(
        directory,
        "src/node_modules/redirected-package/shadow.cjs",
      ).replaceAll("\\", "/");
      const shadowModule: string = join(
        directory,
        "src/node_modules/redirected-package/shadow.mjs",
      ).replaceAll("\\", "/");
      TestValidator.equals(
        "CommonJS redirected dependency",
        [rootCommon, shadowCommon].filter((file: string): boolean =>
          commonPaths.includes(file),
        ),
        [rootCommon],
      );
      TestValidator.equals(
        "ESM redirected dependency",
        [rootModule, shadowModule].filter((file: string): boolean =>
          modulePaths.includes(file),
        ),
        [rootModule],
      );

      const commonSnapshot: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(commonDependencies);
      const moduleSnapshot: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(moduleDependencies);
      await EvidenceTestFileSystem.save(directory, {
        "src/node_modules/redirected-package/shadow.cjs": `module.exports = "edited shadow require";\n`,
        "src/node_modules/redirected-package/shadow.mjs": `export default "edited shadow import";\n`,
      });
      const commonAfterShadow: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(commonDependencies);
      const moduleAfterShadow: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(moduleDependencies);
      TestValidator.predicate(
        "CommonJS shadow edit remains stable",
        commonSnapshot.equals(commonAfterShadow),
      );
      TestValidator.predicate(
        "ESM shadow edit remains stable",
        moduleSnapshot.equals(moduleAfterShadow),
      );
      await EvidenceTestFileSystem.save(directory, {
        "node_modules/redirected-package/root.cjs": `module.exports = "edited root require";\n`,
        "node_modules/redirected-package/root.mjs": `export default "edited root import";\n`,
      });
      const commonAfterRoot: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(commonDependencies);
      const moduleAfterRoot: EvidenceWatchDependencySnapshot =
        await EvidenceWatchDependencySnapshot.capture(moduleDependencies);
      TestValidator.predicate(
        "CommonJS root edit invalidates snapshot",
        !commonSnapshot.equals(commonAfterRoot),
      );
      TestValidator.predicate(
        "ESM root edit invalidates snapshot",
        !moduleSnapshot.equals(moduleAfterRoot),
      );
    },
  );
}

/**
 * Builds the fixture's package imports and self-reference exports.
 *
 * Module type selects the owner's static condition while the import target can
 * be replaced with malformed, conditional, or array values for boundary cases.
 */
function packageManifest(
  type: "commonjs" | "module",
  importTarget: unknown = "./unused-internal.mjs",
): string {
  return JSON.stringify({
    name: "fixture-config",
    type,
    imports: {
      "#settings": {
        import: importTarget,
        require: "./internal.cjs",
      },
      "#external": "mapped-package",
    },
    exports: {
      import: "./unused-self.mjs",
      require: "./self.cjs",
    },
  });
}

/**
 * Gives each active package-map form a null entry before its valid fallback.
 *
 * One configuration load then verifies the shared target-array rule for an
 * internal local mapping, an external redirect, and the package
 * self-reference.
 */
function nullableFallbackManifest(): string {
  return JSON.stringify({
    name: "fixture-config",
    type: "module",
    imports: {
      "#settings": {
        import: [null, "./unused-internal.mjs"],
        require: "./internal.cjs",
      },
      "#external": [null, "mapped-package"],
    },
    exports: {
      import: [null, "./unused-self.mjs"],
      require: "./self.cjs",
    },
  });
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

/**
 * Captures a scanner rejection together with its nested resolution causes.
 *
 * Public context names the authored specifier while the cause chain identifies
 * the package-map rule that failed, allowing one scenario to assert both
 * layers.
 */
async function scanFailure(
  scanner: EvidenceConfigDependencyScanner,
): Promise<string> {
  try {
    await scanner.scan();
  } catch (cause) {
    const messages: string[] = [];
    let current: unknown = cause;
    while (current instanceof Error) {
      messages.push(current.message);
      current = current.cause;
    }
    return messages.join("\n");
  }
  throw new Error("Expected configuration dependency scanning to fail.");
}
