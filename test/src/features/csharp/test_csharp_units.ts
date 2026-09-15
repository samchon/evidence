import {
  EvidenceCSharpAdapter,
  EvidenceLanguageRegistry,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Classifies C# types, members, visibility defaults, and special members.
 *
 * The fixture contrasts public declarations with inaccessible and generated
 * forms so the graph denominator cannot silently shrink or grow.
 *
 * 1. Verify registered C# metadata identifies the certified adapter and grammar
 *    version.
 * 2. Analyze public records, interfaces, structs, enums, delegates, fields,
 *    events, operators, and nested members across partial files.
 * 3. Compare the full unit surface, retain two sites for the partial record and
 *    overload family, and exclude inaccessible declarations.
 */
export async function test_csharp_units(): Promise<void> {
  // Certified metadata names the exact pinned grammar and adapter boundary.
  const language = EvidenceLanguageRegistry.list().find(
    (entry) => entry.type === "csharp",
  );
  if (language === undefined) throw new Error("Missing C# language metadata.");
  if (language.adapter === undefined)
    throw new Error("Missing C# adapter metadata.");
  TestValidator.equals(
    "certified C# adapter",
    language.adapter.entry,
    "EvidenceCSharpAdapter",
  );
  TestValidator.equals(
    "published C# grammar version",
    language.adapter.publicSurface.includes("tree-sitter-c-sharp v0.23.5"),
    true,
  );

  const inventory = await new EvidenceCSharpAdapter().analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/Sale.cs",
        dedent`
          namespace Shop;

          public partial record Sale<T>(int GeneratedId)
          {
              public int Total { get; init; }
              public int First = 1, Second = 2;
              public event Action? Changed;
              public event Action? Updated
              {
                  add { }
                  remove { }
              }

              public int Calculate() => 0;
              public int Calculate(int value) => value;
              public int this[int index] => index;

              public static Sale<T> operator +(Sale<T> left, Sale<T> right) => left;
              public static Sale<T> operator checked +(Sale<T> left, Sale<T> right) => left;
              public static implicit operator int(Sale<T> sale) => sale.Total;
              public static explicit operator checked long(Sale<T> sale) => sale.Total;

              public int @event { get; set; }

              public class Metadata
              {
                  public string Label => "sale";
              }

              private int PrivateValue { get; set; }
              protected int ProtectedValue { get; set; }
              internal int InternalValue { get; set; }
              protected internal int ProtectedInternalValue { get; set; }
              private protected int PrivateProtectedValue { get; set; }
          }
        `,
      ),
      EvidenceTestSourceSnapshot.create(
        "src/Sale.Partial.cs",
        dedent`
          namespace Shop;

          partial record Sale<T>
          {
              public string Description => "selected from another part";
          }
        `,
      ),
      EvidenceTestSourceSnapshot.create(
        "src/Contracts.cs",
        dedent`
          namespace Shop.Contracts
          {
              public interface IService
              {
                  const int Limit = 10;
                  int Count { get; }
                  void Run();
                  event Action Changed;

                  void DefaultMethod() { }
                  public void PublicDefault() { }
                  static int DefaultState = 1;
                  static int DefaultSeed { get; set; } = 1;

                  private void HiddenMethod() { }
                  private static int HiddenState = 2;

                  class DefaultNested
                  {
                      public void Open() { }
                  }
                  public class PublicNested
                  {
                      public void Open() { }
                  }
              }

              public struct Coordinate
              {
                  public int X;
              }

              public enum State
              {
                  Ready,
                  Failed,
              }

              public delegate TResult Factory<T, TResult>(T value);
              public record struct Receipt(int Number);

              internal class InternalType
              {
                  public class NestedLeak
                  {
                      public void Open() { }
                  }
              }
              file class FileType { }
              class DefaultType { }
          }
        `,
      ),
    ]),
  );

  // Only the externally public declared source surface becomes graph units.
  TestValidator.equals("complete C# units", inventory.diagnostics, []);
  TestValidator.equals(
    "C# declaration units",
    inventory.units
      .map((unit) => `${unit.symbol}:${unit.identity.join(".")}`)
      .sort(compare),
    [
      "function:Shop.Contracts.IService.DefaultMethod",
      "function:Shop.Contracts.IService.PublicDefault",
      "function:Shop.Contracts.IService.DefaultNested.Open",
      "function:Shop.Contracts.IService.PublicNested.Open",
      "function:Shop.Contracts.IService.Run",
      "function:Shop.Sale`1.Calculate",
      "function:Shop.Sale`1.explicit operator checked long",
      "function:Shop.Sale`1.implicit operator int",
      "function:Shop.Sale`1.operator +",
      "function:Shop.Sale`1.operator checked +",
      "property:Shop.Contracts.Coordinate.X",
      "property:Shop.Contracts.IService.Changed",
      "property:Shop.Contracts.IService.Count",
      "property:Shop.Contracts.IService.DefaultSeed",
      "property:Shop.Contracts.IService.DefaultState",
      "property:Shop.Contracts.IService.Limit",
      "property:Shop.Contracts.State.Failed",
      "property:Shop.Contracts.State.Ready",
      "property:Shop.Sale`1.Changed",
      "property:Shop.Sale`1.Description",
      "property:Shop.Sale`1.First",
      "property:Shop.Sale`1.Metadata.Label",
      "property:Shop.Sale`1.Second",
      "property:Shop.Sale`1.Total",
      "property:Shop.Sale`1.Updated",
      "property:Shop.Sale`1.event",
      "property:Shop.Sale`1.this[]",
      "type:Shop.Contracts.Coordinate",
      "type:Shop.Contracts.Factory`2",
      "type:Shop.Contracts.IService",
      "type:Shop.Contracts.IService.DefaultNested",
      "type:Shop.Contracts.IService.PublicNested",
      "type:Shop.Contracts.Receipt",
      "type:Shop.Contracts.State",
      "type:Shop.Sale`1",
      "type:Shop.Sale`1.Metadata",
    ].sort(compare),
  );

  // Partial types and overload families retain every selected declaration site.
  const sale = inventory.units.find(
    (unit) => unit.identity.join(".") === "Shop.Sale`1",
  );
  if (sale === undefined) throw new Error("Missing partial C# record.");
  TestValidator.equals("C# partial type sites", sale.sites.length, 2);

  const overload = inventory.units.find(
    (unit) => unit.identity.at(-1) === "Calculate",
  );
  if (overload === undefined) throw new Error("Missing C# overload family.");
  TestValidator.equals("C# overload sites", overload.sites.length, 2);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
