import { TestValidator } from "@nestia/e2e";
import {
  EvidenceConfigDependencyScanner,
  EvidenceConfigLoader,
  type IEvidenceConfig,
  type IEvidenceSourceDependency,
} from "evidence";
import { dedent } from "@typia/utils";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Keeps config dependency discovery complete by accepting static and refusing
 * computed imports.
 *
 * The watcher can monitor a configuration only when its dependency set is known
 * statically, including the module-scope package metadata used for resolution.
 *
 * 1. Scan a configuration with a static local import and require the resolved
 *    helper source and package.json module scope in its dependencies.
 * 2. Replace that import with a runtime-computed CommonJS specifier.
 * 3. Require dependency scanning to reject the computed dependency instead of
 *    publishing a watch set that could miss a future configuration change.
 * 4. Execute and scan an ESM import with query and fragment components; require
 *    its physical target, rather than the URL-qualified spelling, to be
 *    watched.
 * 5. Require Node and the scanner to reject a CommonJS `require()` of an absolute
 *    file URL while preserving ordinary import-mode file URL support.
 * 6. Execute configs with nested lexical bindings named `require`; require the
 *    scanner to omit their calls while retaining unshadowed calls across static
 *    class blocks and strict versus sloppy block-function scopes.
 * 7. Put literals after computed first arguments to `require()` and `import()`;
 *    require rejection, then keep literal first arguments discoverable without
 *    treating later strings or import options as module requests.
 * 8. Preserve script strictness after a hashbang so a block-local function does
 *    not hide the CommonJS wrapper from a later real dependency call.
 * 9. Unwrap parentheses and runtime-erased TypeScript assertions around direct
 *    `require` calls before applying lexical-shadow and first-argument rules.
 * 10. Evaluate a literal `data:` ESM dependency and require scanning to accept the
 *     immutable embedded module without inventing a filesystem dependency.
 */
export async function test_watch_config_dependencies(): Promise<void> {
  const location: string = join(
    __dirname,
    `config dependencies ${randomUUID()}`,
  );
  await EvidenceTestFileSystem.experiment(
    location,
    {
      "helper.ts": `export const files = ["src/**/*.ts"];\n`,
      "package.json": JSON.stringify({ type: "commonjs" }),
      "evidence.config.ts": dedent`
        import { files } from "./helper";

        export default { claims: [], files };
      `,
    },
    async (directory: string): Promise<void> => {
      // Static local imports contribute their exact resolved source file.
      const scanner: EvidenceConfigDependencyScanner =
        new EvidenceConfigDependencyScanner(join(directory, "evidence.config.ts"));
      const dependencies: IEvidenceSourceDependency[] = await scanner.scan();
      TestValidator.predicate(
        "static helper discovered",
        dependencies.some(
          (dependency: IEvidenceSourceDependency): boolean =>
            dependency.path.replaceAll("\\", "/") ===
            join(directory, "helper.ts").replaceAll("\\", "/"),
        ),
      );
      TestValidator.predicate(
        "module scope discovered",
        dependencies.some(
          (dependency: IEvidenceSourceDependency): boolean =>
            dependency.path.replaceAll("\\", "/") ===
            join(directory, "package.json").replaceAll("\\", "/"),
        ),
      );

      // A computed runtime dependency cannot silently produce an incomplete watch set.
      await EvidenceTestFileSystem.save(directory, {
        "evidence.config.ts": dedent`
          const specifier = "./helper";
          const settings = require(specifier);

          export default settings;
        `,
      });
      await TestValidator.error("computed config dependency", async () => {
        await new EvidenceConfigDependencyScanner(
          join(directory, "evidence.config.ts"),
        ).scan();
      });

      await EvidenceTestFileSystem.save(directory, {
        "qualified-target.mjs": `export default "qualified";\n`,
        "qualified.mjs": dedent`
          import value from "./qualified-target.mjs?cache=one#section";
          console.log(value);
        `,
      });
      const qualifiedFile: string = join(directory, "qualified.mjs");
      TestValidator.equals(
        "Node resolves URL-qualified ESM dependency",
        execFileSync(process.execPath, [qualifiedFile], {
          encoding: "utf8",
        }).trim(),
        "qualified",
      );
      const qualifiedDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(qualifiedFile).scan();
      TestValidator.predicate(
        "scanner watches URL-qualified ESM target",
        qualifiedDependencies.some(
          (dependency: IEvidenceSourceDependency): boolean =>
            dependency.path.replaceAll("\\", "/") ===
            join(directory, "qualified-target.mjs").replaceAll("\\", "/"),
        ),
      );

      const targetUrl: string = pathToFileURL(
        join(directory, "qualified-target.mjs"),
      ).href;
      await EvidenceTestFileSystem.save(directory, {
        "require-file-url.cjs": `require(${JSON.stringify(targetUrl)});\n`,
        "import-file-url.mjs": `import value from ${JSON.stringify(targetUrl)}; console.log(value);\n`,
      });
      const requireFileUrl: string = join(directory, "require-file-url.cjs");
      TestValidator.error("Node rejects CommonJS file URL", (): unknown =>
        execFileSync(process.execPath, [requireFileUrl], {
          stdio: ["ignore", "pipe", "ignore"],
        }),
      );
      await TestValidator.error(
        "scanner rejects CommonJS file URL",
        async () => {
          await new EvidenceConfigDependencyScanner(requireFileUrl).scan();
        },
      );
      const importFileUrl: string = join(directory, "import-file-url.mjs");
      TestValidator.equals(
        "Node accepts imported file URL",
        execFileSync(process.execPath, [importFileUrl], {
          encoding: "utf8",
        }).trim(),
        "qualified",
      );
      const fileUrlDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(importFileUrl).scan();
      TestValidator.predicate(
        "scanner watches imported file URL",
        fileUrlDependencies.some(
          (dependency: IEvidenceSourceDependency): boolean =>
            dependency.path.replaceAll("\\", "/") ===
            join(directory, "qualified-target.mjs").replaceAll("\\", "/"),
        ),
      );

      await EvidenceTestFileSystem.save(directory, {
        "outer.cjs": `module.exports = "outer";\n`,
        "strict.cjs": `module.exports = "strict";\n`,
        "shadowed.cjs": dedent`
          require("./outer.cjs");
          function parameter(require) {
            require("missing-parameter");
            (require)("missing-parenthesized-parameter");
          }
          const arrow = ({ local: require }, ...rest) => require(rest[0]);
          function variable() {
            require("missing-var");
            var require = () => undefined;
          }
          function lexical() {
            if (false) {
              require("missing-lexical");
              const { local: require } = {};
            }
          }
          function caught() {
            try {} catch (require) { require("missing-catch"); }
          }
          function declared() {
            require("missing-function");
            function require() {}
          }
          function classified() {
            if (false) {
              require("missing-class");
              class require {}
            }
          }
          const recursive = function require() { require("missing-expression"); };
          function loops() {
            for (const require of []) require("missing-for-const");
            for (var require of []) require("missing-for-var");
          }
          function propertyOnly() {
            const { require: local } = {};
            require("./outer.cjs");
          }
          class StaticBoundary {
            static {
              var require = () => undefined;
              require("missing-static-block");
            }
          }
          function annexB() {
            require("missing-annex-b");
            if (false) {
              function require() {}
            }
          }
          function strictBlock() {
            "use strict";
            require("./strict.cjs");
            if (false) {
              function require() {}
            }
          }
          strictBlock();
          module.exports = { parameter, arrow, variable, lexical, caught, declared, classified, recursive, loops, propertyOnly, StaticBoundary, annexB, strictBlock };
        `,
      });
      const shadowedFile: string = join(directory, "shadowed.cjs");
      execFileSync(process.execPath, [shadowedFile], {
        stdio: ["ignore", "pipe", "ignore"],
      });
      const shadowedDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(shadowedFile).scan();
      TestValidator.predicate(
        "unshadowed CommonJS dependency retained",
        shadowedDependencies.some(
          (dependency: IEvidenceSourceDependency): boolean =>
            dependency.path.replaceAll("\\", "/") ===
            join(directory, "outer.cjs").replaceAll("\\", "/"),
        ),
      );
      TestValidator.equals(
        "shadowed CommonJS calls omitted",
        shadowedDependencies.some(
          (dependency: IEvidenceSourceDependency): boolean =>
            dependency.path.includes("missing-"),
        ),
        false,
      );
      TestValidator.predicate(
        "strict block function stays lexical",
        shadowedDependencies.some(
          (dependency: IEvidenceSourceDependency): boolean =>
            dependency.path.replaceAll("\\", "/") ===
            join(directory, "strict.cjs").replaceAll("\\", "/"),
        ),
      );

      await EvidenceTestFileSystem.save(directory, {
        "computed-require.cjs": dedent`
          const request = "./outer.cjs";
          if (false) require(request, "./strict.cjs");
          module.exports = {};
        `,
        "computed-import.cjs": dedent`
          const request = "./outer.cjs";
          if (false) import(request, { with: { type: "json" } });
          module.exports = {};
        `,
        "literal-first.cjs": dedent`
          require("./outer.cjs", "missing-later-literal");
          if (false) import("./strict.cjs", { with: { type: "json" } });
          module.exports = {};
        `,
        "transparent-require.cjs": dedent`
          console.log(((((require))))("./outer.cjs"));
        `,
        "transparent-require.cts": dedent`
          (require as NodeRequire)("./outer.cjs");
          (require satisfies NodeRequire)("./outer.cjs");
          require!("./outer.cjs");
          (<NodeRequire>require)("./outer.cjs");
          export = {};
        `,
        "transparent-computed.cjs": dedent`
          const request = "./outer.cjs";
          if (false) (require)(request);
          module.exports = {};
        `,
      });
      for (const filename of ["computed-require.cjs", "computed-import.cjs"])
        await TestValidator.error(
          `${filename} computed first argument`,
          async (): Promise<void> => {
            await new EvidenceConfigDependencyScanner(
              join(directory, filename),
            ).scan();
          },
        );
      const literalDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(
          join(directory, "literal-first.cjs"),
        ).scan();
      TestValidator.predicate(
        "literal first arguments retained",
        ["outer.cjs", "strict.cjs"].every((filename: string): boolean =>
          literalDependencies.some(
            (dependency: IEvidenceSourceDependency): boolean =>
              dependency.path.replaceAll("\\", "/") ===
              join(directory, filename).replaceAll("\\", "/"),
          ),
        ),
      );
      TestValidator.equals(
        "later literals are not dependencies",
        literalDependencies.some((dependency: IEvidenceSourceDependency): boolean =>
          dependency.path.includes("missing-later-literal"),
        ),
        false,
      );

      const transparentFile: string = join(
        directory,
        "transparent-require.cjs",
      );
      TestValidator.equals(
        "Node executes parenthesized CommonJS loader",
        execFileSync(process.execPath, [transparentFile], {
          encoding: "utf8",
        }).trim(),
        "outer",
      );
      for (const filename of [
        "transparent-require.cjs",
        "transparent-require.cts",
      ]) {
        const transparentDependencies: IEvidenceSourceDependency[] =
          await new EvidenceConfigDependencyScanner(
            join(directory, filename),
          ).scan();
        TestValidator.predicate(
          `${filename} transparent loader discovered`,
          transparentDependencies.some(
            (dependency: IEvidenceSourceDependency): boolean =>
              dependency.path.replaceAll("\\", "/") ===
              join(directory, "outer.cjs").replaceAll("\\", "/"),
          ),
        );
      }
      await TestValidator.error(
        "parenthesized loader keeps computed-argument rejection",
        async (): Promise<void> => {
          await new EvidenceConfigDependencyScanner(
            join(directory, "transparent-computed.cjs"),
          ).scan();
        },
      );

      await EvidenceTestFileSystem.save(directory, {
        "loader.mjs": `export const loader = () => "local";\n`,
        "shadowed-import.mjs": dedent`
          import { loader as require } from "./loader.mjs";
          console.log(require("missing-import"));
        `,
      });
      const shadowedImportFile: string = join(directory, "shadowed-import.mjs");
      TestValidator.equals(
        "Node calls imported require binding",
        execFileSync(process.execPath, [shadowedImportFile], {
          encoding: "utf8",
        }).trim(),
        "local",
      );
      const importDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(shadowedImportFile).scan();
      TestValidator.predicate(
        "import source retained",
        importDependencies.some(
          (dependency: IEvidenceSourceDependency): boolean =>
            dependency.path.replaceAll("\\", "/") ===
            join(directory, "loader.mjs").replaceAll("\\", "/"),
        ),
      );
      TestValidator.equals(
        "imported require call omitted",
        importDependencies.some((dependency: IEvidenceSourceDependency): boolean =>
          dependency.path.includes("missing-import"),
        ),
        false,
      );

      await EvidenceTestFileSystem.save(directory, {
        "ambient.cts": dedent`
          declare const require: NodeRequire;
          require("./outer.cjs");
          export = {};
        `,
      });
      const ambientDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(
          join(directory, "ambient.cts"),
        ).scan();
      TestValidator.predicate(
        "ambient declaration leaves runtime require visible",
        ambientDependencies.some(
          (dependency: IEvidenceSourceDependency): boolean =>
            dependency.path.replaceAll("\\", "/") ===
            join(directory, "outer.cjs").replaceAll("\\", "/"),
        ),
      );

      await EvidenceTestFileSystem.save(directory, {
        "hashbang-strict.cjs": dedent`
          #!/usr/bin/env node
          // Comments do not end the directive prologue.
          "use strict";
          if (false) {
            function require() {}
          }
          console.log(require("./strict.cjs"));
        `,
        "hashbang-sloppy.cjs": dedent`
          #!/usr/bin/env node
          if (false) {
            function require() {}
          }
          require("missing-hashbang-annex-b");
        `,
      });
      const hashbangFile: string = join(directory, "hashbang-strict.cjs");
      TestValidator.equals(
        "Node preserves strict directive after hashbang",
        execFileSync(process.execPath, [hashbangFile], {
          encoding: "utf8",
        }).trim(),
        "strict",
      );
      const hashbangDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(hashbangFile).scan();
      TestValidator.predicate(
        "hashbang strict dependency retained",
        hashbangDependencies.some(
          (dependency: IEvidenceSourceDependency): boolean =>
            dependency.path.replaceAll("\\", "/") ===
            join(directory, "strict.cjs").replaceAll("\\", "/"),
        ),
      );
      const sloppyHashbangDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(
          join(directory, "hashbang-sloppy.cjs"),
        ).scan();
      TestValidator.equals(
        "sloppy hashbang keeps Annex B shadow",
        sloppyHashbangDependencies.some(
          (dependency: IEvidenceSourceDependency): boolean =>
            dependency.path.includes("missing-hashbang-annex-b"),
        ),
        false,
      );

      const dataTarget: string = join(directory, "data-target.mjs");
      const dataTargetUrl: string = pathToFileURL(dataTarget).href;
      const base64DataModule: string = `data:application/javascript;base64,${Buffer.from(
        `import ${JSON.stringify(dataTargetUrl)};`,
      ).toString("base64")}`;
      const nestedDataModule: string = `data:text/javascript,${encodeURIComponent(
        `import ${JSON.stringify(base64DataModule)};`,
      )}`;
      const relativeDataModule: string = `data:text/javascript,${encodeURIComponent(
        'import "./missing.mjs";',
      )}`;
      await EvidenceTestFileSystem.save(directory, {
        "data-target.mjs": `globalThis.__evidenceDataTarget = true;\n`,
        "data-config.mts": dedent`
          // @ts-expect-error Node resolves the literal data module at runtime.
          await import(${JSON.stringify(`${nestedDataModule}#section`)});

          export default {
            claims: [{
              type: "markdown",
              files: ["rules.md"],
              reference: { type: "markdown", files: ["requirements.md"] },
            }],
          };
        `,
        "data-leaves.mjs": dedent`
          import "data:application/json,%7B%22value%22%3A1%7D" with { type: "json" };
          import "data:application/wasm;base64,AGFzbQEAAAA=" with { type: "wasm" };
        `,
        "data-relative.mjs": `import ${JSON.stringify(relativeDataModule)};\n`,
        "data-require.cjs": `require("data:text/javascript,export default 1");\n`,
      });
      const dataConfig: string = join(directory, "data-config.mts");
      const loadedDataConfig: IEvidenceConfig =
        await EvidenceConfigLoader.load(dataConfig);
      TestValidator.equals(
        "data URL config evaluates",
        loadedDataConfig.claims.length,
        1,
      );
      const dataDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(dataConfig).scan();
      TestValidator.equals(
        "data URL adds no filesystem dependency",
        dataDependencies.some((dependency: IEvidenceSourceDependency): boolean =>
          dependency.path.includes("data:text"),
        ),
        false,
      );
      TestValidator.predicate(
        "nested base64 data URL retains absolute file dependency",
        dataDependencies.some(
          (dependency: IEvidenceSourceDependency): boolean =>
            dependency.path.replaceAll("\\", "/") ===
            dataTarget.replaceAll("\\", "/"),
        ),
      );
      const leafDependencies: IEvidenceSourceDependency[] =
        await new EvidenceConfigDependencyScanner(
          join(directory, "data-leaves.mjs"),
        ).scan();
      TestValidator.equals(
        "JSON and Wasm data URLs are dependency leaves",
        leafDependencies.some((dependency: IEvidenceSourceDependency): boolean =>
          dependency.path.includes("data:"),
        ),
        false,
      );
      for (const filename of ["data-relative.mjs", "data-require.cjs"])
        await TestValidator.error(
          `${filename} invalid data loader boundary`,
          async (): Promise<void> => {
            await new EvidenceConfigDependencyScanner(
              join(directory, filename),
            ).scan();
          },
        );
    },
  );
}
