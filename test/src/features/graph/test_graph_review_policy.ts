import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceFingerprint } from "../../../../packages/evidence/src/graph/EvidenceFingerprint";
import { EvidenceGraph } from "../../../../packages/evidence/src/graph/EvidenceGraph";
import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/adapters/markdown/EvidenceMarkdownAdapter";
import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/adapters/typescript/EvidenceTypeScriptAdapter";
import type { IEvidenceGraphReference } from "../../../../packages/evidence/src/structures/IEvidenceGraphReference";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Reports exactly one actionable review state for each accepted acknowledgement. */
export async function test_graph_review_policy(): Promise<void> {
  const requirements = await new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create(
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
    TestSourceSnapshot.create(
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
    resolutions: await TestGraph.resolveDeclarations(claims, requirements, [
      pricing.id,
    ]),
    reviewResolutions: await TestGraph.resolveReviews(claims, requirements, [
      pricing.id,
    ]),
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
    TestGraph.obligation(result, 0, 0).edges.every(
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
    TestGraph.obligation(interrupted, 0, 0).complete,
    false,
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

function count(
  result: ReturnType<typeof EvidenceGraph.evaluate>,
  code: string,
): number {
  return result.diagnostics.filter((diagnostic) => diagnostic.code === code)
    .length;
}
