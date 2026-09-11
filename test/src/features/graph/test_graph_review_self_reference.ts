import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceFingerprint } from "../../../../packages/evidence/src/EvidenceFingerprint";
import { EvidenceGraph } from "../../../../packages/evidence/src/EvidenceGraph";
import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/EvidenceMarkdownAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Lets a correct review of its own Markdown scope terminate in one edit. */
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
