import { EvidTypeScriptAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Preserves TypeScript syntax and export failures as incomplete analysis.
 *
 * Malformed source and missing export dependencies cannot be masked by
 * tag-shaped strings or prior inventory state.
 *
 * 1. Analyze malformed sources and missing export edges.
 * 2. Verify incomplete status and diagnostics.
 * 3. Require strings containing tags to remain inert.
 */
export async function test_typescript_failures(): Promise<void> {
  const adapter = new EvidTypeScriptAdapter();

  const malformed = await adapter.analyze(
    EvidTestSourceSnapshot.create("src/broken.ts", "export interface Broken {"),
  );
  TestValidator.equals(
    "malformed source is incomplete",
    malformed.complete,
    false,
  );
  TestValidator.equals(
    "malformed source diagnostic",
    malformed.diagnostics.map((diagnostic) => diagnostic.code),
    ["inventory-incomplete", "typescript-parse-incomplete"],
  );

  // The pinned upstream grammar has not yet accepted TypeScript 5.0 type-only star exports.
  const typeOnlyStars = await Promise.all([
    adapter.analyze(
      EvidTestSourceSnapshot.create(
        "src/type-star.ts",
        'export type * from "./contract";',
      ),
    ),
    adapter.analyze(
      EvidTestSourceSnapshot.create(
        "src/type-namespace.ts",
        'export type * as Contract from "./contract";',
      ),
    ),
  ]);
  for (const inventory of typeOnlyStars)
    TestValidator.equals(
      "unsupported type-only star diagnostic",
      inventory.diagnostics.map((diagnostic) => diagnostic.code),
      ["inventory-incomplete", "typescript-parse-incomplete"],
    );

  const missing = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/index.ts",
      'export { Contract } from "./missing";',
    ),
  );
  TestValidator.equals(
    "missing reexport is incomplete",
    missing.complete,
    false,
  );
  TestValidator.equals(
    "missing dependency diagnostic",
    missing.diagnostics.map((diagnostic) => diagnostic.code),
    ["inventory-incomplete", "typescript-export"],
  );

  const missingBinding = await adapter.analyze(
    EvidTestSourceSnapshot.combine([
      EvidTestSourceSnapshot.create(
        "src/available.ts",
        "export const other = 1;",
      ),
      EvidTestSourceSnapshot.create(
        "src/reexport.ts",
        'export { Contract } from "./available";',
      ),
    ]),
  );
  TestValidator.equals(
    "missing export binding is incomplete",
    missingBinding.complete,
    false,
  );
  TestValidator.equals(
    "missing export binding diagnostic",
    missingBinding.diagnostics.map((diagnostic) => diagnostic.code),
    ["inventory-incomplete", "typescript-export"],
  );

  const assignment = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/commonjs.ts",
      "const contract = {}; export = contract;",
    ),
  );
  TestValidator.equals(
    "CommonJS assignment is incomplete",
    assignment.complete,
    false,
  );
  TestValidator.equals(
    "CommonJS assignment diagnostic",
    assignment.diagnostics.map((diagnostic) => diagnostic.code),
    ["inventory-incomplete", "typescript-export-assignment"],
  );

  const ambient = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/ambient.d.ts",
      dedent`
        declare module "external" {
          export interface Contract {}
        }
        declare global {
          interface Window {}
        }
        export as namespace External;
      `,
    ),
  );
  TestValidator.equals(
    "ambient exports are incomplete",
    ambient.complete,
    false,
  );
  TestValidator.equals(
    "ambient export diagnostics",
    ambient.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "inventory-incomplete",
      "typescript-ambient-global",
      "typescript-ambient-module",
      "typescript-umd-export",
    ],
  );

  const tsx = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/view.tsx",
      dedent`
        export const View = () => (
          <div>{"@evidence docs/spec.md#fake This is JSX text."}</div>
        );
      `,
    ),
  );
  TestValidator.equals(
    "TSX string creates no declaration",
    tsx.declarations,
    [],
  );
  TestValidator.equals("valid TSX remains complete", tsx.complete, true);
}
