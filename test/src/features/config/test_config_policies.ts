import type { IEvidenceConfig, IEvidenceReference } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { validateEvidenceConfig } from "@wrtnlabs/evidence";

/**
 * Rejects checklist policies that contradict per-host Markdown answers.
 *
 * Checklist coverage requires every selected host to answer every selected
 * item. Configuration must reject policies that would silently replace this
 * meaning with global host cardinality or shared exclusion carriers.
 *
 * 1. Accept a reviewed Markdown checklist that forbids exclusions.
 * 2. Enable both cardinality flags and require separate diagnostics for
 *    uniqueEvidence and singleEvidencePerSymbol instead of choosing one
 *    policy.
 * 3. Add a checklist property to a TypeScript reference at runtime, even with
 *    value false, and require the artifact-placement diagnostic.
 * 4. Add shared exclusion-carrier globs to a checklist and require rejection.
 * 5. Forbid exclusions on that same reference and require the configuration to
 *    become valid, exercising the permitted counterpart of the carrier rule.
 */
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

/**
 * Places a candidate reference under one active TypeScript claim.
 *
 * Keeping the surrounding claim fixed isolates the checklist policy being
 * accepted or rejected, including mutations of its exclusion-carrier
 * selection.
 */
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

/**
 * Retrieves the fixture's reference in either supported declaration form.
 *
 * A missing claim or reference is a fixture failure. It must not be mistaken
 * for the policy rejection the caller intends to exercise.
 */
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

/**
 * Returns the message from an expected policy-validation error.
 *
 * Successful validation throws a test failure, and non-Error causes propagate.
 * Callers can therefore assert the actual rejected policy rather than mere
 * failure.
 */
function failure(config: IEvidenceConfig): string {
  try {
    validateEvidenceConfig(config);
  } catch (cause) {
    if (cause instanceof Error) return cause.message;
    throw cause;
  }
  throw new Error("Expected Evidence configuration validation to fail.");
}
