import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceFingerprint } from "../../../../packages/evidence/src/EvidenceFingerprint";
import { EvidenceGraph } from "../../../../packages/evidence/src/EvidenceGraph";
import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/EvidenceMarkdownAdapter";
import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/EvidenceTypeScriptAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Pairs reviews by semantic host, resolved target, and acknowledgement kind. */
export async function test_graph_review_pairing(): Promise<void> {
  const requirements = await new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create(
      "docs/spec.md",
      dedent`
        ## Pricing {#pricing}

        The rate is capped.

        ## Tax {#tax}

        The tax service owns jurisdiction rules.
      `,
    ),
  );
  const pricing = requireUnit(requirements, "pricing");
  const tax = requireUnit(requirements, "tax");
  const pricingFingerprint = EvidenceFingerprint.inspect(
    requirements,
    pricing.id,
  ).fingerprint;
  const taxFingerprint = EvidenceFingerprint.inspect(
    requirements,
    tax.id,
  ).fingerprint;
  const claims = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/pairing.ts",
      dedent`
        /** @evidence ../docs/spec.md#pricing Implements the pricing rule. */
        export interface Merged {
          price: number;
        }

        /** @evidenceReview ../docs/spec.md#pricing #${pricingFingerprint} Checked both halves of the merged contract. */
        export namespace Merged {
          export const category = "retail";
        }

        /**
         * @evidenceExclude ../docs/spec.md#tax The tax service owns this rule.
         * @evidenceReview ../docs/spec.md#tax #${taxFingerprint} Filed under the wrong question.
         */
        export function wrongKind(): void {}

        /** @evidenceReview ../docs/spec.md#pricing #${pricingFingerprint} Reviewed another host's citation. */
        export function orphan(): void {}

        /**
         * @evidence ../docs/spec.md#pricing Implements the pricing rule.
         * @evidenceReview ../docs/spec.md#pricing #${pricingFingerprint} Checked the cap once.
         * @evidenceReview ../docs/spec.md#pricing #${pricingFingerprint} Checked the cap twice.
         */
        export function duplicate(): void {}
      `,
    ),
  );
  const unitIds = ["Merged", "wrongKind", "orphan", "duplicate"].map(
    (name) => requireUnit(claims, name).id,
  );
  const selected = [pricing.id, tax.id];
  const result = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claims,
        unitIds,
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: selected,
            resolutions: await TestGraph.resolveDeclarations(
              claims,
              requirements,
              selected,
            ),
            reviewResolutions: await TestGraph.resolveReviews(
              claims,
              requirements,
              selected,
            ),
            requireReview: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "wrong review kind",
    count(result, "graph-review-kind"),
    1,
  );
  TestValidator.equals(
    "unrelated semantic host remains orphaned",
    count(result, "graph-orphan-review"),
    1,
  );
  TestValidator.equals(
    "same documentation position repeats review",
    count(result, "graph-duplicate-review"),
    1,
  );
  TestValidator.equals(
    "wrong-kind review suppresses derivative missing review",
    count(result, "graph-missing-review"),
    0,
  );
  TestValidator.equals(
    "merged identity accepts review from another declaration",
    result.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code.includes("review") &&
        diagnostic.message.includes("Merged"),
    ),
    [],
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
