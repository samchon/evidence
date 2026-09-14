import type { IEvidenceConfig } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { validateEvidenceConfig } from "../../../../packages/evidence/src/internal/validateEvidenceConfig";

/** Rejects vacuous and unsupported populations even when their severity is inactive. */
export function test_config_constraints(): void {
  const emptyGraph = failure({ claims: [] });

  TestValidator.predicate(
    "empty graph",
    emptyGraph.includes("at least one claim is required"),
  );

  const invalid: IEvidenceConfig = {
    claims: [
      {
        type: "typescript",
        disabled: true,
        root: "C:source",
        files: [],
        symbol: [],
        evidenceExcludeCarriers: ["!src/exclusions.ts"],
        reference: [],
      },
      {
        type: "kotlin",
        severity: "off",
        files: ["src/**"],
        reference: {
          type: "swagger",
          severity: "off",
          file: " openapi.json ",
        },
      },
      {
        type: "typescript",
        files: ["src/**"],
        reference: {
          type: "markdown",
          files: ["!docs/private/**"],
          symbol: [],
        },
      },
    ],
  };
  const message = failure(invalid);

  // A disabled claim remains fully validated before it can leave the load plan.
  for (const expected of [
    "claims[0].root",
    "claims[0].files",
    "claims[0].symbol",
    "claims[0].evidenceExcludeCarriers",
    "claims[0].reference",
  ])
    TestValidator.predicate(
      `disabled population constraint: ${expected}`,
      message.includes(expected),
    );

  // Off populations reject unavailable adapters, malformed exact sources, and empty selectors.
  for (const expected of [
    "claims[1].type: artifact type 'kotlin' has no certified Evidence adapter",
    "claims[1].reference.file",
    "claims[2].reference.files",
    "claims[2].reference.symbol",
  ])
    TestValidator.predicate(
      `inactive population constraint: ${expected}`,
      message.includes(expected),
    );
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
