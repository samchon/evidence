import { EvidenceCSharpAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/**
 * Merges C# partial declarations only inside one configured snapshot root.
 * Two parts retain every site, while equal names under unrelated roots remain
 * different identities.
 */
export async function test_csharp_partials(): Promise<void> {
  const adapter = new EvidenceCSharpAdapter();

  // Accessibility declared on one part applies to members selected from every part.
  const partial = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "Project/Sale.cs",
        dedent`
          namespace Shop
          {
              public partial class Sale
              {
                  public int First { get; set; }
                  public partial string Name { get; set; }
                  public partial int this[int index] { get; set; }
              }
          }
        `,
      ),
      TestSourceSnapshot.create(
        "Project/Sale.Partial.cs",
        dedent`
          namespace Shop;

          partial class Sale
          {
              public int Second => 2;

              private string name = "sale";
              public partial string Name
              {
                  get => name;
                  set => name = value;
              }

              public partial int this[int index] => index;
          }
        `,
      ),
    ]),
  );
  TestValidator.equals("complete partial C# type", partial.diagnostics, []);
  TestValidator.equals(
    "members from every C# part",
    partial.units.map((unit) => unit.identity.join(".")).sort(compare),
    [
      "Shop.Sale",
      "Shop.Sale.First",
      "Shop.Sale.Name",
      "Shop.Sale.Second",
      "Shop.Sale.this[]",
    ],
  );
  for (const name of ["Name", "this[]"]) {
    const unit = partial.units.find((candidate) => candidate.name === name);
    if (unit === undefined)
      throw new Error(`Missing partial C# member: ${name}`);
    TestValidator.equals(`partial C# ${name} sites`, unit.sites.length, 2);
  }

  // Relative configured roots are stable compilation-boundary keys.
  const firstProject = TestSourceSnapshot.create(
    "Sale.cs",
    "public class Sale {}\n",
    ["Sale.cs"],
    "/repository/First",
  );
  firstProject.root.declared = "First";
  firstProject.root.display = "First";
  const secondProject = TestSourceSnapshot.create(
    "Sale.cs",
    "public class Sale {}\n",
    ["Sale.cs"],
    "/repository/Second",
  );
  secondProject.root.declared = "Second";
  secondProject.root.display = "Second";

  const first = await adapter.analyze(firstProject);
  const second = await adapter.analyze(secondProject);
  TestValidator.notEquals(
    "unrelated C# compilation identities",
    first.units[0]?.id,
    second.units[0]?.id,
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
