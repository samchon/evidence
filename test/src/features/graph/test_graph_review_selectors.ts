import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceFingerprint } from "../../../../packages/evidence/src/EvidenceFingerprint";
import { EvidenceGraph } from "../../../../packages/evidence/src/EvidenceGraph";
import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/EvidenceMarkdownAdapter";
import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/EvidenceTypeScriptAdapter";
import type { IEvidenceGraphReference } from "../../../../packages/evidence/src/structures/IEvidenceGraphReference";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Shares one review fingerprint across selectors and public aliases of one identity. */
export async function test_graph_review_selectors(): Promise<void> {
  const requirements = await new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create(
      "docs/spec.md",
      dedent`
        ## Pricing {#pricing}

        The rate is capped.

        ### Coupons {#coupons}

        One coupon applies per issuer.
      `,
      ["docs/spec.md", "requirements/spec.md"],
    ),
  );
  const pricing = requireUnit(requirements, "pricing");
  const coupons = requireUnit(requirements, "coupons");
  const expected = EvidenceFingerprint.inspect(
    requirements,
    pricing.id,
  ).fingerprint;
  const claim = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/sale.ts",
      dedent`
        /**
         * @evidence docs/spec.md#pricing Implements the whole pricing scope.
         * @evidenceReview requirements/spec.md#pricing #${expected} Read the pricing and coupon rules.
         */
        export function price(): void {}
      `,
    ),
  );
  const price = requireUnit(claim, "price");
  const references: IEvidenceGraphReference[] = [];
  for (const unitIds of [[pricing.id], [coupons.id]])
    references.push({
      severity: "error",
      inventory: requirements,
      unitIds,
      resolutions: await TestGraph.resolveDeclarations(
        claim,
        requirements,
        unitIds,
      ),
      reviewResolutions: await TestGraph.resolveReviews(
        claim,
        requirements,
        unitIds,
      ),
      requireReview: true,
    });
  const result = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: [price.id],
        references,
      },
    ],
  });

  TestValidator.equals(
    "both selector obligations are current",
    result.diagnostics,
    [],
  );
  const claimResult = result.claims[0];
  if (claimResult === undefined)
    throw new Error("Missing review claim result.");
  TestValidator.equals(
    "selector-independent edge fingerprints",
    claimResult.obligations.map(
      (obligation) => obligation.edges[0]?.fingerprint,
    ),
    [expected, expected],
  );
}

function requireUnit(
  inventory: IEvidenceInventory,
  identity: string,
): IEvidenceUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === identity || candidate.identity.at(-1) === identity,
  );
  if (unit === undefined) throw new Error(`Missing review unit: ${identity}`);
  return unit;
}
