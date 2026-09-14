import { EvidenceTypeScriptAdapter } from "@wrtnlabs/evidence";
import type { IEvidenceInventory } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Resolves aliases, defaults, type-only edges, imports, stars, and namespace reexports. */
export async function test_typescript_exports(): Promise<void> {
  const snapshot = TestSourceSnapshot.combine([
    TestSourceSnapshot.create(
      "src/dep.ts",
      dedent`
        export interface Shape { side: number; }
        export class Box { member = 1; }
        export const run = (): void => {}, value = 42;
        export enum Ignored { VALUE }
      `,
    ),
    TestSourceSnapshot.create("src/star.ts", "export const starred = true;"),
    TestSourceSnapshot.create(
      "src/default-interface.ts",
      "export default interface DefaultContract { value: string; }",
    ),
    TestSourceSnapshot.create(
      "src/index.ts",
      dedent`
        export { Shape as RenamedShape, run as execute } from "./dep";
        export type { Box as BoxType } from "./dep";
        export * as API from "./dep";
        export * from "./star";
        export { default as DefaultShape } from "./default-interface";
        export { Ignored } from "./dep";

        import { value as imported } from "./dep";
        export { imported as answer };

        const local = 1;
        enum LocalEnum { VALUE }
        export { local as alias };
        export { LocalEnum as IgnoredLocal };
        export default local;
      `,
    ),
  ]);
  const inventory = await new EvidenceTypeScriptAdapter().analyze(snapshot);
  const index = addresses(inventory, "/project/src/index.ts");

  TestValidator.equals("public barrel addresses", index, [
    "API.Box",
    "API.Box.prototype.member",
    "API.Shape",
    "API.Shape.side",
    "API.run",
    "API.value",
    "BoxType",
    "DefaultShape",
    "DefaultShape.value",
    "RenamedShape",
    "RenamedShape.side",
    "alias",
    "answer",
    "default",
    "execute",
    "starred",
  ]);
  TestValidator.predicate(
    "type-only class export hides value-space members",
    !index.includes("BoxType.prototype.member"),
  );
  TestValidator.predicate(
    "excluded enums create no addresses",
    !index.some((address) => address.includes("Ignored")),
  );

  const aliases = inventory.addresses
    .filter(
      (address) =>
        address.file === "/project/src/index.ts" &&
        (address.segments[0] === "alias" || address.segments[0] === "default"),
    )
    .map((address) => address.unitId);
  TestValidator.equals("two aliases are published", aliases.length, 2);
  TestValidator.equals(
    "default and named aliases share identity",
    new Set(aliases).size,
    1,
  );
  TestValidator.equals("complete export traversal", inventory.diagnostics, []);

  // Drive-letter paths must stay absolute while resolving relative reexports.
  const windows = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/Windows-Dependency.ts",
        "export interface WindowsContract { value: string; }",
        undefined,
        "D:/project",
      ),
      TestSourceSnapshot.create(
        "src/windows-index.ts",
        'export { WindowsContract } from "./windows-dependency";',
        undefined,
        "D:/project",
      ),
    ]),
  );
  TestValidator.equals(
    "Windows drive reexport",
    addresses(windows, "D:/project/src/windows-index.ts"),
    ["WindowsContract", "WindowsContract.value"],
  );
  TestValidator.equals("complete Windows traversal", windows.diagnostics, []);
}

function addresses(inventory: IEvidenceInventory, file: string): string[] {
  return inventory.addresses
    .filter((address) => address.file === file)
    .map((address) => address.segments.join("."))
    .sort(compare);
}

function compare(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0;
}
