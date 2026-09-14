import { EvidenceTypeScriptAdapter } from "@wrtnlabs/evidence";
import type { IEvidenceInventory, IEvidenceUnit } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Reconciles TypeScript merged declarations into stable units.
 *
 * Overloads and class/interface merges share semantic identity while retaining the sites needed for review.
 *
 * 1. Analyze overload and declaration merge inputs.
 * 2. Verify merged identities, sites, and resolution.
 */
export async function test_typescript_merges(): Promise<void> {
  const content = dedent`
    /** Text overload. */
    export function format(value: string): string;
    /** Numeric overload. */
    export function format(value: number): string;
    export function format(value: string | number): string { return String(value); }

    export class Service {
      run(): void {}
    }
    export interface Service {
      stop(): void;
      state: string;
    }

    export function helper(): void {}
    export namespace helper {
      export const generated = 1;
    }

    interface Order {
      member: number;
    }
    namespace Order {
      export const member = 1;
    }
    export type { Order };
  `;
  const inventory = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create("src/merged.ts", content),
  );

  const overload = requireUnit(inventory, "function", "format");
  TestValidator.equals("one overload identity", count(inventory, "format"), 1);
  TestValidator.equals(
    "all overload declaration sites",
    overload.sites.length,
    3,
  );

  const service = requireUnit(inventory, "type", "Service");
  TestValidator.equals(
    "class and interface sites merge",
    service.sites.length,
    2,
  );
  TestValidator.equals(
    "interface members join the class instance side",
    inventory.units
      .filter((unit) => unit.parentId === service.id)
      .map((unit) => unit.identity.join("."))
      .sort(compare),
    [
      "Service.prototype.run",
      "Service.prototype.state",
      "Service.prototype.stop",
    ],
  );

  // A function companion namespace contributes its type identity without generated static members.
  TestValidator.equals(
    "function namespace static side excluded",
    inventory.units.some(
      (unit) => unit.identity.join(".") === "helper.generated",
    ),
    false,
  );

  // Either half of a merged member can make one identity available in type space.
  const orderMember = requireUnit(inventory, "property", "Order.member");
  TestValidator.equals(
    "merged member retains both declarations",
    orderMember.sites.length,
    2,
  );
  TestValidator.predicate(
    "type-only merge keeps the interface member",
    inventory.addresses.some(
      (address) =>
        address.unitId === orderMember.id &&
        address.segments.join(".") === "Order.member",
    ),
  );
  TestValidator.equals("valid merged inventory", inventory.diagnostics, []);
}

function requireUnit(
  inventory: IEvidenceInventory,
  symbol: IEvidenceUnit["symbol"],
  identity: string,
): IEvidenceUnit {
  const unit = inventory.units.find(
    (entry) => entry.symbol === symbol && entry.identity.join(".") === identity,
  );
  if (unit === undefined)
    throw new Error(`Missing TypeScript unit: ${symbol} ${identity}`);
  return unit;
}

function count(inventory: IEvidenceInventory, identity: string): number {
  return inventory.units.filter((unit) => unit.identity.join(".") === identity)
    .length;
}

function compare(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0;
}
