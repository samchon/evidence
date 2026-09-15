import {
  EvidenceJavaScriptAdapter,
  EvidenceLanguageRegistry,
  EvidenceSourceLoader,
  EvidenceSourcePath,
} from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Selects JavaScript module semantics from extensions and nearest package
 * metadata.
 *
 * Resolution must use the applicable file extension and package boundary rather
 * than a global module assumption.
 *
 * 1. Create sources under contrasting package metadata.
 * 2. Analyze each extension.
 * 3. Verify the selected module mode and resulting exports.
 */
export async function test_javascript_module_modes(): Promise<void> {
  const language = EvidenceLanguageRegistry.list().find(
    (entry) => entry.type === "javascript",
  );
  TestValidator.equals(
    "certified JavaScript adapter",
    language?.adapter?.entry,
    "EvidenceJavaScriptAdapter",
  );

  const location = join(__dirname, "modules " + randomUUID());

  await EvidenceTestFileSystem.experiment(
    location,
    {
      "package.json": '{"type":"module"}',
      "src/main.js": "export const javascript = 1;",
      "src/view.jsx": "export const View = () => <main />;",
      "src/forced.mjs": "export const module = 1;",
      "src/forced.cjs": dedent`
        const common = 1;
        module.exports.common = common;
      `,
      "src/legacy/package.json": '{"type":"commonjs"}',
      "src/legacy/main.js": dedent`
        const legacy = 1;
        exports.legacy = legacy;
      `,
    },
    async (directory) => {
      const snapshot = await EvidenceSourceLoader.glob(
        join(directory, "evidence.config.ts"),
        {
          files: [
            "src/**/*.js",
            "src/**/*.jsx",
            "src/**/*.mjs",
            "src/**/*.cjs",
          ],
        },
      );
      const inventory = await new EvidenceJavaScriptAdapter().analyze(snapshot);

      TestValidator.equals(
        "extension and package module units",
        inventory.units.map((unit) => unit.name).sort(compare),
        ["View", "common", "javascript", "legacy", "module"],
      );
      TestValidator.equals("complete module modes", inventory.diagnostics, []);

      const dependencies = inventory.dependencies.map((entry) => entry.path);
      TestValidator.predicate(
        "root package metadata dependency",
        dependencies.includes(
          EvidenceSourcePath.slash(join(directory, "package.json")),
        ),
      );
      TestValidator.predicate(
        "nearest package metadata dependency",
        dependencies.includes(
          EvidenceSourcePath.slash(join(directory, "src/legacy/package.json")),
        ),
      );
    },
  );

  const conflicting = await new EvidenceJavaScriptAdapter().analyze(
    EvidenceTestSourceSnapshot.create("src/alias.mjs", "export const value = 1;", [
      "src/alias.mjs",
      "src/alias.cjs",
    ]),
  );
  TestValidator.predicate(
    "conflicting alias modes",
    conflicting.diagnostics.some(
      (diagnostic) => diagnostic.code === "javascript-module-mode",
    ),
  );

  await EvidenceTestFileSystem.experiment(
    join(__dirname, "invalid package " + randomUUID()),
    {
      "package.json": "{ invalid",
      "src/main.js": "const value = 1; exports.value = value;",
    },
    async (directory) => {
      const snapshot = await EvidenceSourceLoader.glob(
        join(directory, "evidence.config.ts"),
        { files: ["src/**/*.js"] },
      );
      const inventory = await new EvidenceJavaScriptAdapter().analyze(snapshot);

      TestValidator.predicate(
        "invalid package metadata",
        inventory.diagnostics.some(
          (diagnostic) => diagnostic.code === "javascript-package-json",
        ),
      );
      TestValidator.equals(
        "invalid metadata is incomplete",
        inventory.complete,
        false,
      );
    },
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
