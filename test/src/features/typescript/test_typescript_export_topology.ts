import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/adapters/typescript/EvidenceTypeScriptAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Exercises transitive export space, shadowing, ambiguity, cycles, and emitted extensions. */
export async function test_typescript_export_topology(): Promise<void> {
  const adapter = new EvidenceTypeScriptAdapter();

  // A type-only mark must survive every barrel above the edge that introduced it.
  const typeOnly = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/surface.ts",
        dedent`
          export class Sale { amount = 1; }
          export interface Input { id: string; validate(): void; }
          export function execute(): void {}
        `,
      ),
      TestSourceSnapshot.create(
        "src/value-barrel.ts",
        'export * from "./surface.js";',
      ),
      TestSourceSnapshot.create(
        "src/type-barrel.ts",
        'export type { Sale, Input, execute } from "./value-barrel.js";',
      ),
      TestSourceSnapshot.create(
        "src/type-entry.ts",
        'export * from "./type-barrel.js";',
      ),
    ]),
  );
  TestValidator.equals(
    "complete transitive type-only traversal",
    typeOnly.diagnostics,
    [],
  );
  TestValidator.equals(
    "transitive type-only population",
    addresses(typeOnly, "/project/src/type-entry.ts"),
    ["Input", "Input.id", "Input.validate", "Sale"],
  );

  // An explicit export shadows star candidates, while two star candidates remain ambiguous.
  const competing = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/alpha.ts",
        "export class Contract { alpha = 1; }",
      ),
      TestSourceSnapshot.create(
        "src/beta.ts",
        "export class Contract { beta = 1; }",
      ),
      TestSourceSnapshot.create(
        "src/shadow.ts",
        dedent`
          export * from "./alpha";
          export { Contract } from "./beta";
        `,
      ),
      TestSourceSnapshot.create(
        "src/ambiguous.ts",
        dedent`
          export * from "./alpha";
          export * from "./beta";
        `,
      ),
    ]),
  );
  TestValidator.equals(
    "explicit export shadows stars",
    addresses(competing, "/project/src/shadow.ts"),
    ["Contract", "Contract.prototype.beta"],
  );
  TestValidator.equals(
    "ambiguous stars retain both candidates",
    addresses(competing, "/project/src/ambiguous.ts"),
    [
      "Contract",
      "Contract",
      "Contract.prototype.alpha",
      "Contract.prototype.beta",
    ],
  );

  // Namespace cycles terminate while retaining declarations reached before re-entry.
  const finiteCycle = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/cycle-a.ts",
        dedent`
          export interface A { value: string; }
          export * as BModule from "./cycle-b";
        `,
      ),
      TestSourceSnapshot.create(
        "src/cycle-b.ts",
        dedent`
          export interface B { value: string; }
          export * as AModule from "./cycle-a";
        `,
      ),
    ]),
  );
  TestValidator.equals(
    "finite namespace cycle",
    addresses(finiteCycle, "/project/src/cycle-a.ts"),
    [
      "A",
      "A.value",
      "BModule.AModule.A",
      "BModule.AModule.A.value",
      "BModule.B",
      "BModule.B.value",
    ],
  );
  TestValidator.equals("complete finite cycle", finiteCycle.diagnostics, []);

  // Emitted JavaScript specifiers resolve to their TypeScript source variants.
  const substitutions = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/module.mts",
        "export interface ModuleContract {}",
      ),
      TestSourceSnapshot.create(
        "src/common.cts",
        "export interface CommonContract {}",
      ),
      TestSourceSnapshot.create(
        "src/extensions.ts",
        dedent`
          export { ModuleContract } from "./module.mjs";
          export { CommonContract } from "./common.cjs";
        `,
      ),
    ]),
  );
  TestValidator.equals(
    "TypeScript extension substitutions",
    addresses(substitutions, "/project/src/extensions.ts"),
    ["CommonContract", "ModuleContract"],
  );

  // Mutually advertised names without any declaration cannot become a complete empty surface.
  const emptyCycle = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/empty-a.ts",
        'export { Missing } from "./empty-b";',
      ),
      TestSourceSnapshot.create(
        "src/empty-b.ts",
        'export { Missing } from "./empty-a";',
      ),
    ]),
  );
  TestValidator.equals(
    "declaration-free cycle is incomplete",
    emptyCycle.complete,
    false,
  );
  TestValidator.equals(
    "declaration-free cycle diagnostics",
    emptyCycle.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === "typescript-export" &&
        diagnostic.message.includes("declaration-free cycle"),
    ).length,
    2,
  );
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
