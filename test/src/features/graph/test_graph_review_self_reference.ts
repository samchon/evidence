import {
  EvidenceFingerprint,
  EvidenceGraph,
  EvidenceMarkdownAdapter,
} from "@wrtnlabs/evidence";
import type { IEvidenceInventory, IEvidenceUnit } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/**
 * Accepts a Markdown section's current review of its own evidence target.
 *
 * A review annotation changes the source file that contains the target. The
 * fingerprint calculation must exclude accepted review annotation spans so an
 * author can add the required self-review without immediately making it stale.
 *
 * 1. Analyze a bare Markdown rule and record its target fingerprint.
 * 2. Add a self acknowledgement and review carrying that fingerprint, then
 *    require the rule's recomputed fingerprint to remain unchanged.
 * 3. Evaluate the section as both claim and required-review reference target.
 * 4. Require no diagnostics and a successful current self-review.
 */
export async function test_graph_review_self_reference(): Promise<void> {
  const bare = await analyze(
    dedent`
      ## Review discipline {#review-discipline}

      Re-read a cited rule when its content changes.
    `,
  );
  const bareRule = requireUnit(bare, "review-discipline");
  const expected = EvidenceFingerprint.inspect(bare, bareRule.id).fingerprint;
  const reviewed = await analyze(
    dedent`
      ## Review discipline {#review-discipline}

      Re-read a cited rule when its content changes.

      <!--
      @evidence ./rules.md#review-discipline Enforces this rule on its own section.
      @evidenceReview ./rules.md#review-discipline #${expected} Read the section and checked the self-reference.
      -->
    `,
  );
  const reviewedRule = requireUnit(reviewed, "review-discipline");

  TestValidator.equals(
    "writing review leaves target fingerprint stable",
    EvidenceFingerprint.inspect(reviewed, reviewedRule.id).fingerprint,
    expected,
  );

  const result = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: reviewed,
        unitIds: [reviewedRule.id],
        references: [
          {
            severity: "error",
            inventory: reviewed,
            unitIds: [reviewedRule.id],
            resolutions: await TestGraph.resolveDeclarations(
              reviewed,
              reviewed,
              [reviewedRule.id],
            ),
            reviewResolutions: await TestGraph.resolveReviews(
              reviewed,
              reviewed,
              [reviewedRule.id],
            ),
            requireReview: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals("self-review diagnostics", result.diagnostics, []);
  TestValidator.predicate("self-review is current", result.success);
}

/**
 * Extracts a Markdown rule from the fixed source identity used by the self-review fixture.
 *
 * Keeping the file path and document-relative base stable isolates the inserted
 * acknowledgement and review spans from target-resolution or identity changes.
 */
async function analyze(content: string): Promise<IEvidenceInventory> {
  return new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create(
      "rules.md",
      content,
      ["rules.md"],
      "/project/docs",
    ),
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
