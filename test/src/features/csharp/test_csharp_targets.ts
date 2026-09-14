import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceCSharpAdapter } from "../../../../packages/evidence/src/adapters/csharp/EvidenceCSharpAdapter";
import type { EvidenceTargetResolutionStatus } from "../../../../packages/evidence/src/typings/EvidenceTargetResolutionStatus";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

interface ICSharpTargetStatus {
  target: string | undefined;
  status: EvidenceTargetResolutionStatus;
}

/**
 * Resolves C# namespaces, generic arity, indexers, and operator families.
 * Exact and ambiguous paths are paired so a convenient alias cannot select a
 * different semantic owner.
 */
export async function test_csharp_targets(): Promise<void> {
  const adapter = new EvidenceCSharpAdapter();
  const reference = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/Models.cs",
      dedent`
        namespace Shop;

        public class Sale
        {
            public int Total { get; set; }
            public int Calculate() => 0;
            public int Calculate(int value) => value;
            public int this[int index] => index;
            public int this[string key] => key.Length;

            public static Sale operator +(Sale left, Sale right) => left;
            public static Sale operator checked +(Sale left, Sale right) => left;
            public static implicit operator int(Sale sale) => sale.Total;
            public static explicit operator checked long(Sale sale) => sale.Total;
        }

        public class Box { }
        public class Box<T>
        {
            public int Value { get; set; }
        }
        public class Box<T, U> { }

        public class Pair<T> { }
        public class Pair<T, U> { }
      `,
    ),
  );
  const claim = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/Verify.cs",
      dedent`
        /// <summary>
        /// @evidence Models.cs#Shop.Sale Verifies the public type.
        /// @evidence Models.cs#Shop.Sale.Total Verifies the public property.
        /// @evidence Models.cs#Shop.Sale.Calculate Verifies every overload.
        /// @evidence Models.cs#Shop.Sale["this[]"] Verifies the indexer family.
        /// @evidence Models.cs#Shop.Sale["operator +"] Verifies the addition operator.
        /// @evidence Models.cs#Shop.Sale["operator checked +"] Verifies the checked addition operator.
        /// @evidence Models.cs#Shop.Sale["implicit operator int"] Verifies conversion.
        /// @evidence Models.cs#Shop.Sale["explicit operator checked long"] Verifies checked conversion.
        /// @evidence Models.cs#Shop["Box\`1"] Verifies generic arity one.
        /// @evidence Models.cs#Shop["Box\`1"].Value Verifies its exact member path.
        /// @evidence Models.cs#Shop.Box Verifies the non-generic canonical address.
        /// @evidence Models.cs#Shop.Box.Value Cannot cross into its generic alias subtree.
        /// @evidence Models.cs#Shop.Pair Demonstrates an ambiguous generic short alias.
        /// </summary>
        public class Verify { }
      `,
    ),
  );

  TestValidator.equals(
    "complete C# target reference",
    reference.diagnostics,
    [],
  );
  TestValidator.equals("complete C# target claim", claim.diagnostics, []);
  const resolutions = await TestGraph.resolveDeclarations(
    claim,
    reference,
    reference.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "C# target statuses",
    resolutions
      .map((resolution) => ({
        target: claim.declarations.find(
          (declaration) => declaration.id === resolution.declarationId,
        )?.target,
        status: resolution.resolution.status,
      }))
      .sort(compareTarget),
    (<ICSharpTargetStatus[]>[
      { target: "Models.cs#Shop.Sale", status: "resolved" },
      { target: "Models.cs#Shop.Sale.Total", status: "resolved" },
      { target: "Models.cs#Shop.Sale.Calculate", status: "resolved" },
      { target: 'Models.cs#Shop.Sale["this[]"]', status: "resolved" },
      { target: 'Models.cs#Shop.Sale["operator +"]', status: "resolved" },
      {
        target: 'Models.cs#Shop.Sale["operator checked +"]',
        status: "resolved",
      },
      {
        target: 'Models.cs#Shop.Sale["explicit operator checked long"]',
        status: "resolved",
      },
      {
        target: 'Models.cs#Shop.Sale["implicit operator int"]',
        status: "resolved",
      },
      { target: "Models.cs#Shop.Box", status: "resolved" },
      { target: "Models.cs#Shop.Box.Value", status: "missing-member" },
      { target: "Models.cs#Shop.Pair", status: "ambiguous" },
      { target: 'Models.cs#Shop["Box`1"]', status: "resolved" },
      { target: 'Models.cs#Shop["Box`1"].Value', status: "resolved" },
    ]).sort(compareTarget),
  );

  // Name-only methods and indexers retain every overload declaration site.
  for (const target of ["#Shop.Sale.Calculate", '#Shop.Sale["this[]"]']) {
    const declaration = claim.declarations.find((candidate) =>
      candidate.target.endsWith(target),
    );
    if (declaration === undefined)
      throw new Error(`Missing C# target declaration: ${target}`);
    const resolution = resolutions.find(
      (candidate) => candidate.declarationId === declaration.id,
    );
    if (resolution === undefined)
      throw new Error(`Missing C# target resolution: ${target}`);
    const unit = resolution.resolution.units[0];
    if (unit === undefined)
      throw new Error(`Missing resolved C# target unit: ${target}`);
    TestValidator.equals(`${target} declaration sites`, unit.sites.length, 2);
  }
}

function compareTarget(
  left: ICSharpTargetStatus,
  right: ICSharpTargetStatus,
): number {
  return compare(left.target ?? "", right.target ?? "");
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
