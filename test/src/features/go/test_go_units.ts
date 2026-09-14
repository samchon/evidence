import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceGoAdapter } from "../../../../packages/evidence/src/adapters/go/EvidenceGoAdapter";
import { EvidenceLanguageRegistry } from "../../../../packages/evidence/src/parsers/EvidenceLanguageRegistry";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Classifies exported Go declarations, embedded fields, interfaces, and receivers. */
export async function test_go_units(): Promise<void> {
  const language = EvidenceLanguageRegistry.list().find(
    (entry) => entry.type === "go",
  );
  if (language === undefined) throw new Error("Missing Go language metadata.");
  TestValidator.equals(
    "certified Go adapter",
    language.adapter?.entry,
    "EvidenceGoAdapter",
  );

  const inventory = await new EvidenceGoAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "shop/sale.go",
        dedent`
          package shop

          type Sale[T any] struct {
              Total int
              First, Second int
              private string
              Embedded
              *remote.External
          }

          type (
              Alias = Sale[int]
              AliasRecord = struct {
                  Field int
              }
              AliasContract = interface {
                  Execute() error
              }
              Pair[T any] struct {
                  Left, Right T
              }
          )

          type Service interface {
              Run() error
              private()
              EmbeddedContract
          }

          type privateOwner struct {
              Visible int
          }

          type Σervice struct {
              Δelta int
          }

          func Add(left, right int) int {
              return left + right
          }

          func local() {}

          const (
              Version = 1
              Maximum, Minimum = 10, 0
          )

          var (
              Current string
              Left, Right int
          )
        ` + "\n",
      ),
      TestSourceSnapshot.create(
        "shop/methods.go",
        dedent`
          package shop

          func (sale Sale[T]) Value() int {
              return sale.Total
          }

          func (sale *Sale[T]) Save() {}

          func (value privateOwner) Public() {}
        `,
      ),
    ]),
  );

  TestValidator.equals("complete Go units", inventory.diagnostics, []);
  TestValidator.equals(
    "Go declaration units",
    inventory.units
      .map((unit) => `${unit.symbol}:${unit.identity.join(".")}`)
      .sort(compare),
    [
      "function:Add",
      "function:AliasContract.Execute",
      "function:Sale.Save",
      "function:Sale.Value",
      "function:Service.Run",
      "property:Current",
      "property:AliasRecord.Field",
      "property:Pair.Left",
      "property:Pair.Right",
      "property:Left",
      "property:Maximum",
      "property:Minimum",
      "property:Right",
      "property:Sale.Embedded",
      "property:Sale.External",
      "property:Sale.First",
      "property:Sale.Second",
      "property:Sale.Total",
      "property:Version",
      "property:Σervice.Δelta",
      "type:Alias",
      "type:AliasContract",
      "type:AliasRecord",
      "type:Pair",
      "type:Sale",
      "type:Service",
      "type:Σervice",
    ].sort(compare),
  );

  const sale = requireUnit(inventory, "Sale");
  for (const identity of ["Sale.Total", "Sale.Value", "Sale.Save"])
    TestValidator.equals(
      `Go parent for ${identity}`,
      inventory.units.find((unit) => unit.identity.join(".") === identity)
        ?.parentId,
      sale.id,
    );

  TestValidator.equals(
    "method declaring and owner file addresses",
    inventory.addresses
      .filter((address) => address.segments.join(".") === "Sale.Value")
      .map((address) => address.file)
      .sort(compare),
    ["/project/shop/methods.go", "/project/shop/sale.go"],
  );
}

function requireUnit(
  inventory: IEvidenceInventory,
  name: string,
): IEvidenceUnit {
  const unit = inventory.units.find((candidate) => candidate.name === name);
  if (unit === undefined) throw new Error(`Missing Go unit: ${name}`);
  return unit;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
