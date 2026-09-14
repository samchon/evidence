import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceFingerprint } from "../../../../packages/evidence/src/graph/EvidenceFingerprint";
import { EvidenceGraph } from "../../../../packages/evidence/src/graph/EvidenceGraph";
import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/adapters/markdown/EvidenceMarkdownAdapter";
import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/adapters/typescript/EvidenceTypeScriptAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Evaluates Markdown as a claim against Markdown and code references. */
export async function test_graph_markdown_chain(): Promise<void> {
  const implementation = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/calculator.ts",
      "export function calculatePrice(): number { return 0; }",
    ),
  );
  const calculatePrice = requireUnit(implementation, "calculatePrice");
  const implementationFingerprint = EvidenceFingerprint.inspect(
    implementation,
    calculatePrice.id,
  ).fingerprint;

  // The middle Markdown document claims that one TypeScript export implements its rule.
  const requirements = await new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create(
      "docs/requirements.md",
      dedent`
        ## Pricing {#pricing}

        Calculate the final price.

        <!--
        @evidence ../src/calculator.ts#calculatePrice Names the public implementation.
        @evidenceReview ../src/calculator.ts#calculatePrice #${implementationFingerprint} Read the function and checked the return contract.
        -->
      `,
    ),
  );
  const pricing = requireUnit(requirements, "pricing");
  const requirementFingerprint = EvidenceFingerprint.inspect(
    requirements,
    pricing.id,
  ).fingerprint;

  // The downstream Markdown guide claims that it explains the middle requirement.
  const guide = await new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create(
      "docs/guide.md",
      dedent`
        ## Checkout guide {#checkout}

        Apply the configured pricing rule.

        <!--
        @evidence docs/requirements.md#pricing Explains the pricing requirement.
        @evidenceReview docs/requirements.md#pricing #${requirementFingerprint} Read the requirement and checked the guide steps.
        -->
      `,
    ),
  );
  const checkout = requireUnit(guide, "checkout");
  const result = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: guide,
        unitIds: [checkout.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [pricing.id],
            resolutions: await TestGraph.resolveDeclarations(
              guide,
              requirements,
              [pricing.id],
            ),
            reviewResolutions: await TestGraph.resolveReviews(
              guide,
              requirements,
              [pricing.id],
            ),
            requireReview: true,
          },
        ],
      },
      {
        severity: "error",
        inventory: requirements,
        unitIds: [pricing.id],
        references: [
          {
            severity: "error",
            inventory: implementation,
            unitIds: [calculatePrice.id],
            resolutions: await TestGraph.resolveDeclarations(
              requirements,
              implementation,
              [calculatePrice.id],
            ),
            reviewResolutions: await TestGraph.resolveReviews(
              requirements,
              implementation,
              [calculatePrice.id],
            ),
            requireReview: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals("Markdown chain diagnostics", result.diagnostics, []);
  TestValidator.predicate("Markdown chain succeeds", result.success);

  // Failed claim discovery remains active and cannot become an empty passing host set.
  const failedGuide = await new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.fail(
      TestSourceSnapshot.create("docs/guide.md", "## Checkout {#checkout}"),
      {
        code: "path-unreadable",
        path: "/project/docs/missing.md",
        message: "The selected Markdown claim source could not be read.",
      },
    ),
  );
  const interrupted = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: failedGuide,
        unitIds: failedGuide.units.map((unit) => unit.id),
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [pricing.id],
            resolutions: [],
          },
        ],
      },
    ],
  });

  const interruptedClaim = interrupted.claims[0];
  if (interruptedClaim === undefined)
    throw new Error("Missing interrupted Markdown claim result.");
  TestValidator.equals(
    "failed Markdown claim remains active",
    interruptedClaim.active,
    true,
  );
  TestValidator.equals(
    "failed Markdown claim remains incomplete",
    interruptedClaim.complete,
    false,
  );
  TestValidator.equals(
    "failed claim suppresses derivative coverage findings",
    interrupted.diagnostics.filter((diagnostic) =>
      ["graph-empty-reference", "graph-missing-acknowledgement"].includes(
        diagnostic.code,
      ),
    ),
    [],
  );
}

function requireUnit(
  inventory: IEvidenceInventory,
  identity: string,
): IEvidenceUnit {
  const unit = inventory.units.find(
    (candidate) => candidate.identity.at(-1) === identity,
  );
  if (unit === undefined)
    throw new Error(`Missing Markdown chain unit: ${identity}`);
  return unit;
}
