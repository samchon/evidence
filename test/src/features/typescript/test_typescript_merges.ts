import { EvidTypeScriptAdapter } from "evid";
import type {
  IEvidInventory,
  IEvidPublicAddress,
  IEvidUnit,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/**
 * Reconciles TypeScript merged declarations into stable units.
 *
 * TypeScript overloads and declaration merging share semantic identity while
 * retaining every site needed for review. A namespace nested interface remains
 * addressable through the merged outer interface and namespace spelling.
 *
 * 1. Analyze function overloads, class/interface merges, function namespaces,
 *    and an interface with a companion namespace containing another interface.
 * 2. Require overload and class/interface sites to merge without duplicating
 *    semantic units.
 * 3. Verify namespace members retain their public nested paths, including
 *    `IShoppingSale.ICreate.title`.
 * 4. Require the resulting inventory to remain complete and diagnostic-free.
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

    export interface IShoppingSale {
      id: string;
    }
    export namespace IShoppingSale {
      export interface ICreate {
        title: string;
      }
    }
  `;
  const inventory = await new EvidTypeScriptAdapter().analyze(
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

  TestValidator.equals(
    "function namespace static side excluded",
    inventory.units.some(
      (unit) => unit.identity.join(".") === "helper.generated",
    ),
    false,
  );

  const orderMember = requireUnit(inventory, "property", "Order.member");
  TestValidator.equals(
    "merged member retains both declarations",
    orderMember.sites.length,
    2,
  );
  TestValidator.predicate(
    "type-only merge keeps the interface member",
    inventory.addresses.some(
      (address: IEvidPublicAddress): boolean =>
        address.unitId === orderMember.id &&
        address.segments.join(".") === "Order.member",
    ),
  );

  const shoppingSale: IEvidUnit = requireUnit(
    inventory,
    "type",
    "IShoppingSale",
  );
  TestValidator.equals(
    "interface and namespace sites merge",
    shoppingSale.sites.length,
    2,
  );
  const create: IEvidUnit = requireUnit(
    inventory,
    "type",
    "IShoppingSale.ICreate",
  );
  const title: IEvidUnit = requireUnit(
    inventory,
    "property",
    "IShoppingSale.ICreate.title",
  );
  TestValidator.equals(
    "nested interface parent",
    create.parentId,
    shoppingSale.id,
  );
  TestValidator.equals("nested property parent", title.parentId, create.id);
  TestValidator.predicate(
    "nested namespace type address",
    inventory.addresses.some(
      (address: IEvidPublicAddress): boolean =>
        address.unitId === create.id &&
        address.segments.join(".") === "IShoppingSale.ICreate",
    ),
  );
  TestValidator.predicate(
    "nested namespace property address",
    inventory.addresses.some(
      (address: IEvidPublicAddress): boolean =>
        address.unitId === title.id &&
        address.segments.join(".") === "IShoppingSale.ICreate.title",
    ),
  );
  TestValidator.equals("valid merged inventory", inventory.diagnostics, []);
}

/**
 * Requires one TypeScript unit with an exact symbol and semantic identity.
 *
 * Merge assertions must fail on absence before site or ownership checks can
 * accidentally inspect a different declaration kind at the same address.
 */
function requireUnit(
  inventory: IEvidInventory,
  symbol: IEvidUnit["symbol"],
  identity: string,
): IEvidUnit {
  const unit = inventory.units.find(
    (entry) => entry.symbol === symbol && entry.identity.join(".") === identity,
  );
  if (unit === undefined)
    throw new Error(`Missing TypeScript unit: ${symbol} ${identity}`);
  return unit;
}

/**
 * Counts units sharing one rendered semantic identity.
 *
 * The count exposes duplicate merge records even when a public-address lookup
 * could resolve only the first occurrence.
 */
function count(inventory: IEvidInventory, identity: string): number {
  return inventory.units.filter((unit) => unit.identity.join(".") === identity)
    .length;
}

/**
 * Orders expected TypeScript identities by exact spelling.
 *
 * Locale-independent comparison keeps fixture output stable across CI hosts.
 */
function compare(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0;
}
