import { EvidenceJavaScriptAdapter } from "evidence";
import type { IEvidenceInventory } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Resolves JavaScript aliases, defaults, imports, star exports, shadowing, and
 * cycles.
 *
 * Module topology must retain defining identity while exposing supported public
 * aliases.
 *
 * 1. Analyze the module graph.
 * 2. Resolve exported paths.
 * 3. Verify shadowing and cycles do not merge distinct owners.
 */
export async function test_javascript_exports(): Promise<void> {
  const adapter = new EvidenceJavaScriptAdapter();
  const inventory = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/dep.mjs",
        dedent`
          export class Service { run() {} }
          export function execute() {}
          export const value = 1;
        `,
      ),
      EvidenceTestSourceSnapshot.create(
        "src/default.mjs",
        "export default class DefaultService { value = 1; }",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/star.mjs",
        "export const starred = true;",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/index.mjs",
        dedent`
          export { Service as Renamed, execute as run } from "./dep.mjs";
          export * as API from "./dep.mjs";
          export * from "./star.mjs";
          export { default as DefaultService } from "./default.mjs";

          import { value as imported } from "./dep.mjs";
          export { imported as answer };

          export { later as beforeDeclaration };
          const later = 2;
          export default later;
        `,
      ),
    ]),
  );

  TestValidator.equals("JavaScript barrel addresses", addresses(inventory), [
    "API.Service",
    "API.Service.prototype.run",
    "API.execute",
    "API.value",
    "DefaultService",
    "DefaultService.prototype.value",
    "Renamed",
    "Renamed.prototype.run",
    "answer",
    "beforeDeclaration",
    "default",
    "run",
    "starred",
  ]);
  TestValidator.equals(
    "complete JavaScript exports",
    inventory.diagnostics,
    [],
  );

  const aliases = inventory.addresses
    .filter(
      (address) =>
        address.file === "/project/src/index.mjs" &&
        ["beforeDeclaration", "default"].includes(address.segments[0] ?? ""),
    )
    .map((address) => address.unitId);
  TestValidator.equals(
    "default alias retains identity",
    new Set(aliases).size,
    1,
  );

  // A barrel cycle terminates after retaining declarations reached before re-entry.
  const cycle = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/a.mjs",
        dedent`
          export const a = 1;
          export * as B from "./b.mjs";
        `,
      ),
      EvidenceTestSourceSnapshot.create(
        "src/b.mjs",
        dedent`
          export const b = 1;
          export * as A from "./a.mjs";
        `,
      ),
    ]),
  );
  TestValidator.equals(
    "finite JavaScript cycle",
    cycle.addresses
      .filter((address) => address.file === "/project/src/a.mjs")
      .map((address) => address.segments.join("."))
      .sort(compare),
    ["B.A.a", "B.b", "a"],
  );
  TestValidator.equals("complete JavaScript cycle", cycle.diagnostics, []);
}

function addresses(inventory: IEvidenceInventory): string[] {
  return inventory.addresses
    .filter((address) => address.file === "/project/src/index.mjs")
    .map((address) => address.segments.join("."))
    .sort(compare);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
