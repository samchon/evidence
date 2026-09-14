import {
  EvidenceGraph,
  EvidenceMarkdownAdapter,
  EvidenceTypeScriptAdapter,
} from "@wrtnlabs/evidence";
import type { IEvidenceInventory, IEvidenceUnit } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/**
 * Retains a review's pairing when checklist policy refuses its aggregate acknowledgement.
 *
 * The function acknowledges the whole Markdown document while the checklist
 * selects only its price section. The aggregate acknowledgement needs its own
 * repair, but its attached review must not become an unrelated orphan.
 *
 * 1. Analyze a Markdown price rule and a function with document-level evidence
 *    plus a review of that same document-level acknowledgement.
 * 2. Evaluate the price section as a checklist target.
 * 3. Require one refused-aggregate diagnostic and no orphan-review diagnostic.
 */
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
