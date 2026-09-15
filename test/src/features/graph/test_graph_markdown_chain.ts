import {
  EvidFingerprint,
  EvidGraph,
  EvidMarkdownAdapter,
  EvidTypeScriptAdapter,
} from "evid";
import type { IEvidInventory, IEvidUnit } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Carries reviewed evidence through a Markdown-to-Markdown-to-TypeScript chain.
 *
 * Markdown sections may serve as claims as well as reference targets. The graph
 * must preserve each hop's declaration and review resolution, and must still
 * report a failed Markdown claim even when it yields no selected hosts.
 *
 * 1. Analyze a TypeScript pricing export and record its content fingerprint.
 * 2. Analyze a Markdown pricing requirement that acknowledges and reviews that
 *    export, then record the requirement's own fingerprint.
 * 3. Analyze a Markdown checkout guide that acknowledges and reviews the pricing
 *    requirement, evaluate both graph hops, and require no diagnostics or failures.
 * 4. Analyze a failed version of the Markdown claim and require that its graph
 *    result remains active and incomplete while suppressing empty-reference and
 *    missing-acknowledgement findings derived from unavailable claim content.
 */
export async function test_graph_markdown_chain(): Promise<void> {
  const implementation = await new EvidTypeScriptAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/calculator.ts",
      "export function calculatePrice(): number { return 0; }",
    ),
  );
  const calculatePrice = requireUnit(implementation, "calculatePrice");
  const implementationFingerprint = EvidFingerprint.inspect(
    implementation,
    calculatePrice.id,
  ).fingerprint;

  // The middle Markdown document claims that one TypeScript export implements its rule.
  const requirements = await new EvidMarkdownAdapter().analyze(
    EvidTestSourceSnapshot.create(
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
  const requirementFingerprint = EvidFingerprint.inspect(
    requirements,
    pricing.id,
  ).fingerprint;

  // The downstream Markdown guide claims that it explains the middle requirement.
  const guide = await new EvidMarkdownAdapter().analyze(
    EvidTestSourceSnapshot.create(
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
  const result = EvidGraph.evaluate({
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
            resolutions: await EvidTestGraph.resolveDeclarations(
              guide,
              requirements,
              [pricing.id],
            ),
            reviewResolutions: await EvidTestGraph.resolveReviews(
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
            resolutions: await EvidTestGraph.resolveDeclarations(
              requirements,
              implementation,
              [calculatePrice.id],
            ),
            reviewResolutions: await EvidTestGraph.resolveReviews(
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
  const failedGuide = await new EvidMarkdownAdapter().analyze(
    EvidTestSourceSnapshot.fail(
      EvidTestSourceSnapshot.create("docs/guide.md", "## Checkout {#checkout}"),
      {
        code: "path-unreadable",
        path: "/project/docs/missing.md",
        message: "The selected Markdown claim source could not be read.",
      },
    ),
  );
  const interrupted = EvidGraph.evaluate({
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
  inventory: IEvidInventory,
  identity: string,
): IEvidUnit {
  const unit = inventory.units.find(
    (candidate) => candidate.identity.at(-1) === identity,
  );
  if (unit === undefined)
    throw new Error(`Missing Markdown chain unit: ${identity}`);
  return unit;
}
