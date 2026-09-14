import {
  EvidenceFingerprint,
  EvidenceGraph,
  EvidenceMarkdownAdapter,
  EvidenceTypeScriptAdapter,
} from "@wrtnlabs/evidence";
import type {
  IEvidenceGraphReference,
  IEvidenceInventory,
  IEvidenceUnit,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/**
 * Reuses one current review across selected scopes and public aliases of the same identity.
 *
 * The pricing section has two public paths and contains a coupons subsection.
 * A single acknowledgement and review through the alias must satisfy separate
 * selector obligations without changing the target fingerprint carried by edges.
 *
 * 1. Analyze aliased Markdown pricing and coupons scopes, then obtain the pricing
 *    fingerprint from the shared semantic unit.
 * 2. Analyze a function that acknowledges pricing through one path and reviews it
 *    through the other alias with that fingerprint.
 * 3. Evaluate separate pricing and coupons reference selectors with required reviews.
 * 4. Require no diagnostics and require both obligations' first edges to carry
 *    the same expected pricing fingerprint.
 */
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
