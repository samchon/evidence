import { EvidenceTypeScriptAdapter } from "evidence";
import type { IEvidenceInventory } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Evaluates TypeScript export topology across transitive modules.
 *
 * Shadowing, ambiguity, cycles, and emitted extensions determine whether a
 * public export can be resolved safely.
 *
 * 1. Analyze transitive export graphs with each topology condition.
 * 2. Verify public results and incomplete or ambiguous boundaries.
 */
export async function test_typescript_export_topology(): Promise<void> {
  const adapter = new EvidenceTypeScriptAdapter();

  // A type-only mark must survive every barrel above the edge that introduced it.
  const typeOnly = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/surface.ts",
        dedent`
          export class Sale { amount = 1; }
          export interface Input { id: string; validate(): void; }
          export function execute(): void {}
        `,
      ),
      EvidenceTestSourceSnapshot.create(
        "src/value-barrel.ts",
        'export * from "./surface.js";',
      ),
      EvidenceTestSourceSnapshot.create(
        "src/type-barrel.ts",
        'export type { Sale, Input, execute } from "./value-barrel.js";',
      ),
      EvidenceTestSourceSnapshot.create(
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
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/alpha.ts",
        "export class Contract { alpha = 1; }",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/beta.ts",
        "export class Contract { beta = 1; }",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/shadow.ts",
        dedent`
          export * from "./alpha";
          export { Contract } from "./beta";
        `,
      ),
      EvidenceTestSourceSnapshot.create(
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
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/cycle-a.ts",
        dedent`
          export interface A { value: string; }
          export * as BModule from "./cycle-b";
        `,
      ),
      EvidenceTestSourceSnapshot.create(
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
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/module.mts",
        "export interface ModuleContract {}",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/common.cts",
        "export interface CommonContract {}",
      ),
      EvidenceTestSourceSnapshot.create(
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
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/empty-a.ts",
        'export { Missing } from "./empty-b";',
      ),
      EvidenceTestSourceSnapshot.create(
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
