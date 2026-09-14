import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceGraph } from "../../../../packages/evidence/src/graph/EvidenceGraph";
import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/adapters/markdown/EvidenceMarkdownAdapter";
import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/adapters/typescript/EvidenceTypeScriptAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps a review paired when policy refuses its otherwise valid acknowledgement. */
export async function test_graph_review_refused_acknowledgement(): Promise<void> {
  const requirements = await new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create(
      "docs/rules.md",
      dedent`
        # Rules

        ## Price {#price}

        Cap the price adjustment.
      `,
    ),
  );
  const price = requireUnit(requirements, "price");
  const claims = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/pricing.ts",
      dedent`
        /**
         * @evidence docs/rules.md Implements all rules.
         * @evidenceReview docs/rules.md Reviewed the aggregate statement.
         */
        export function priceSale(): void {}
      `,
    ),
  );
  const priceSale = requireUnit(claims, "priceSale");
  const result = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claims,
        unitIds: [priceSale.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [price.id],
            resolutions: await TestGraph.resolveDeclarations(
              claims,
              requirements,
              [price.id],
            ),
            reviewResolutions: await TestGraph.resolveReviews(
              claims,
              requirements,
              [price.id],
            ),
            checklist: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "aggregate acknowledgement remains refused",
    count(result, "graph-checklist-aggregate"),
    1,
  );
  TestValidator.equals(
    "review of refused acknowledgement is not orphaned",
    count(result, "graph-orphan-review"),
    0,
  );
}

function requireUnit(
  inventory: IEvidenceInventory,
  identity: string,
): IEvidenceUnit {
  const unit = inventory.units.find(
    (candidate) => candidate.identity.at(-1) === identity,
  );
  if (unit === undefined) throw new Error(`Missing review unit: ${identity}`);
  return unit;
}

function count(
  result: ReturnType<typeof EvidenceGraph.evaluate>,
  code: string,
): number {
  return result.diagnostics.filter((diagnostic) => diagnostic.code === code)
    .length;
}
