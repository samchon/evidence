import {
  EvidenceFingerprint,
  EvidenceGraph,
  EvidenceMarkdownAdapter,
  EvidenceTypeScriptAdapter,
} from "evidence";
import type { IEvidenceGraphReference, IEvidenceInventory, IEvidenceUnit } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestGraph } from "../../internal/EvidenceTestGraph";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Classifies required evidence reviews by the presence and freshness of
 * fingerprints.
 *
 * One requirement is acknowledged by four functions whose review states differ.
 * The graph should issue the actionable repair for each state once and stop
 * deriving review freshness when resolution data is incomplete.
 *
 * 1. Create missing, unfingerprinted, stale, and current review declarations for
 *    one Markdown requirement, then enable required reviews.
 * 2. Require exactly one diagnostic for each repairable state:
 *
 *    - A missing review.
 *    - A review with no fingerprint.
 *    - A review whose fingerprint differs from the current target.
 * 3. Require every review repair and every graph edge to carry the current
 *    fingerprint obtained from the target inventory.
 * 4. Disable the requirement policy and require the same declarations to emit no
 *    review-freshness diagnostics.
 * 5. Mark the review resolution incomplete and require an incomplete obligation
 *    with no derived missing, absent-fingerprint, or stale-review finding.
 */
export async function test_graph_review_policy(): Promise<void> {
  const requirements = await new EvidenceMarkdownAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "docs/spec.md",
      dedent`
        ## Pricing {#pricing}

        The rate is capped at thirty percent.
      `,
    ),
  );
  const pricing = requireUnit(requirements, "pricing");
  const expected = EvidenceFingerprint.inspect(
    requirements,
    pricing.id,
  ).fingerprint;
  const claims = await new EvidenceTypeScriptAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/reviews.ts",
      dedent`
        /** @evidence docs/spec.md#pricing Implements the pricing rule. */
        export function missing(): void {}

        /**
         * @evidence docs/spec.md#pricing Implements the pricing rule.
         * @evidenceReview docs/spec.md#pricing Checked the cap.
         */
        export function unfingerprinted(): void {}

        /**
         * @evidence docs/spec.md#pricing Implements the pricing rule.
         * @evidenceReview docs/spec.md#pricing #0000000 Checked the old cap.
         */
        export function stale(): void {}

        /**
         * @evidence docs/spec.md#pricing Implements the pricing rule.
         * @evidenceReview docs/spec.md#pricing #${expected} Read the cap and exercised the clamp.
         */
        export function current(): void {}
      `,
    ),
  );
  const unitIds = ["missing", "unfingerprinted", "stale", "current"].map(
    (name) => requireUnit(claims, name).id,
  );
  const reference: IEvidenceGraphReference = {
    severity: "error",
    inventory: requirements,
    unitIds: [pricing.id],
    resolutions: await EvidenceTestGraph.resolveDeclarations(claims, requirements, [
      pricing.id,
    ]),
    reviewResolutions: await EvidenceTestGraph.resolveReviews(
      claims,
      requirements,
      [pricing.id],
    ),
    requireReview: true,
  };
  const result = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claims,
        unitIds,
        references: [reference],
      },
    ],
  });

  TestValidator.equals(
    "one missing review",
    count(result, "graph-missing-review"),
    1,
  );
  TestValidator.equals(
    "one missing fingerprint",
    count(result, "graph-missing-review-fingerprint"),
    1,
  );
  TestValidator.equals(
    "one stale fingerprint",
    count(result, "graph-stale-review"),
    1,
  );
  TestValidator.predicate(
    "every repair names current fingerprint",
    result.diagnostics
      .filter((diagnostic) => diagnostic.code.includes("review"))
      .every(
        (diagnostic) =>
          diagnostic.message.includes(`#${expected}`) ||
          diagnostic.repair.includes(`#${expected}`),
      ),
  );
  TestValidator.predicate(
    "inspection and graph edges agree",
    EvidenceTestGraph.obligation(result, 0, 0).edges.every(
      (edge) => edge.fingerprint === expected,
    ),
  );

  // The same explicit reviews impose no freshness requirement without the policy.
  const optional = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claims,
        unitIds,
        references: [{ ...reference, requireReview: false }],
      },
    ],
  });

  TestValidator.equals(
    "review expiry remains opt in",
    optional.diagnostics.filter((diagnostic) =>
      [
        "graph-missing-review",
        "graph-missing-review-fingerprint",
        "graph-stale-review",
      ].includes(diagnostic.code),
    ),
    [],
  );

  // An incomplete review lookup stops the obligation before deriving freshness findings.
  const incomplete = structuredClone(reference);
  const reviewResolution = incomplete.reviewResolutions?.[0];
  if (reviewResolution === undefined)
    throw new Error("Missing review resolution fixture.");
  reviewResolution.resolution.status = "incomplete";
  reviewResolution.resolution.units = [];
  reviewResolution.resolution.diagnostics = [
    {
      code: "fixture-review-analysis",
      severity: "error",
      message: "The review target analysis is incomplete.",
      repair: "Restore the referenced source and analyze it again.",
    },
  ];
  const interrupted = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claims,
        unitIds,
        references: [incomplete],
      },
    ],
  });

  TestValidator.equals(
    "incomplete review lookup suppresses freshness findings",
    interrupted.diagnostics.filter((diagnostic) =>
      [
        "graph-missing-review",
        "graph-missing-review-fingerprint",
        "graph-stale-review",
      ].includes(diagnostic.code),
    ),
    [],
  );
  TestValidator.equals(
    "incomplete review lookup keeps obligation incomplete",
    EvidenceTestGraph.obligation(interrupted, 0, 0).complete,
    false,
  );
}

function requireUnit(inventory: IEvidenceInventory, identity: string): IEvidenceUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === identity || candidate.identity.at(-1) === identity,
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
