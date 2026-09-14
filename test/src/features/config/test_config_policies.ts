import type { IEvidenceConfig, IEvidenceReference } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { validateEvidenceConfig } from "../../../../packages/evidence/src/internal/validateEvidenceConfig";

/** Rejects checklist placements and combinations with contradictory obligations. */
export async function test_config_policies(): Promise<void> {
  const checklist = createConfig({
    type: "markdown",
    files: ["docs/**"],
    checklist: true,
    noEvidenceExclude: true,
    requireReview: true,
  });

  validateEvidenceConfig(checklist);

  // Both cardinality policies are reported rather than silently choosing one.
  const cardinality = createConfig({
    type: "markdown",
    files: ["docs/**"],
    checklist: true,
    uniqueEvidence: true,
    singleEvidencePerSymbol: true,
  });
  const cardinalityMessage = failure(cardinality);

  TestValidator.predicate(
    "checklist rejects unique evidence",
    cardinalityMessage.includes(
      "checklist and uniqueEvidence cannot both hold",
    ),
  );
  TestValidator.predicate(
    "checklist rejects single evidence",
    cardinalityMessage.includes(
      "checklist and singleEvidencePerSymbol cannot both hold",
    ),
  );

  // Runtime configuration cannot smuggle checklist onto another artifact kind.
  const foreign = createConfig({
    type: "typescript",
    files: ["contracts/**"],
  });
  Reflect.set(firstReference(foreign), "checklist", false);

  TestValidator.predicate(
    "foreign checklist",
    failure(foreign).includes("only a Markdown reference can be a checklist"),
  );

  // Shared exclusion carriers contradict host-local exclusions unless exclusions are forbidden.
  const carriers = createConfig({
    type: "markdown",
    files: ["docs/**"],
    checklist: true,
  });
  const carrierClaim = carriers.claims[0];
  if (carrierClaim === undefined)
    throw new Error("Missing carrier claim fixture.");
  carrierClaim.evidenceExcludeCarriers = ["src/exclusions.ts"];

  TestValidator.predicate(
    "gathered checklist exclusions",
    failure(carriers).includes(
      "cannot gather checklist exclusions into shared carriers",
    ),
  );
  const strict = firstReference(carriers);
  if (strict.type !== "markdown")
    throw new Error("Missing Markdown checklist fixture.");
  strict.noEvidenceExclude = true;

  validateEvidenceConfig(carriers);
}

function createConfig(reference: IEvidenceReference): IEvidenceConfig {
  return {
    claims: [
      {
        type: "typescript",
        files: ["src/**"],
        reference,
      },
    ],
  };
}

function firstReference(config: IEvidenceConfig): IEvidenceReference {
  const claim = config.claims[0];
  if (claim === undefined) throw new Error("Missing policy claim fixture.");
  const reference = Array.isArray(claim.reference)
    ? claim.reference[0]
    : claim.reference;
  if (reference === undefined)
    throw new Error("Missing policy reference fixture.");
  return reference;
}

function failure(config: IEvidenceConfig): string {
  try {
    validateEvidenceConfig(config);
  } catch (cause) {
    if (cause instanceof Error) return cause.message;
    throw cause;
  }
  throw new Error("Expected Evidence configuration validation to fail.");
}
