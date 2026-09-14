import type { IEvidenceConfig } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { createEvidenceConfigPlan } from "../../../../packages/evidence/src/internal/createEvidenceConfigPlan";

/** Resolves selector and severity defaults before filtering inactive populations. */
export function test_config_resolution(): void {
  const config: IEvidenceConfig = {
    severity: "warning",
    claims: [
      {
        type: "typescript",
        files: ["src/**"],
        reference: [
          { type: "markdown", files: ["docs/**"] },
          { type: "typescript", files: ["contracts/**"], severity: "error" },
          { type: "swagger", file: "openapi.json", severity: "off" },
        ],
      },
      {
        type: "prisma",
        files: ["prisma/**"],
        severity: "error",
        reference: { type: "prisma", files: ["requirements/**"] },
      },
      {
        type: "swagger",
        files: ["openapi/**"],
        reference: { type: "markdown", files: ["docs/api/**"] },
      },
      {
        type: "typescript",
        disabled: true,
        files: ["disabled/**"],
        reference: { type: "markdown", files: ["disabled-docs/**"] },
      },
      {
        type: "typescript",
        severity: "off",
        files: ["off/**"],
        reference: {
          type: "markdown",
          files: ["off-docs/**"],
          severity: "error",
        },
      },
      {
        type: "typescript",
        files: ["no-obligation/**"],
        reference: {
          type: "markdown",
          files: ["no-obligation-docs/**"],
          severity: "off",
        },
      },
    ],
  };

  const plan = createEvidenceConfigPlan(config);
  const programming = plan.claims[0];
  const database = plan.claims[1];
  const swagger = plan.claims[2];
  if (
    programming === undefined ||
    database === undefined ||
    swagger === undefined
  )
    throw new Error("Missing enabled configuration plan fixture.");
  const markdownReference = programming.references[0];
  const programmingReference = programming.references[1];
  const databaseReference = database.references[0];
  if (
    markdownReference === undefined ||
    programmingReference === undefined ||
    databaseReference === undefined
  )
    throw new Error("Missing enabled reference plan fixture.");

  TestValidator.equals(
    "default configuration anchor",
    plan.configFile.replaceAll("\\", "/").endsWith("/evidence.config.ts"),
    true,
  );

  // Original indexes survive filtering so diagnostics still name the authored entry.
  TestValidator.equals(
    "enabled claim indexes",
    plan.claims.map((claim) => claim.index),
    [0, 1, 2],
  );
  TestValidator.equals(
    "enabled reference indexes",
    programming.references.map((reference) => reference.index),
    [0, 1],
  );

  // Programming populations use different claim and reference defaults.
  TestValidator.equals("programming claim defaults", programming.symbols, [
    "type",
    "function",
    "property",
  ]);
  TestValidator.equals(
    "Markdown reference defaults",
    markdownReference.symbols,
    ["file", "h1", "h2", "h3", "h4"],
  );
  TestValidator.equals(
    "programming reference defaults",
    programmingReference.symbols,
    ["type"],
  );

  // Database and Swagger families retain their own unit granularity.
  TestValidator.equals("database claim defaults", database.symbols, [
    "model",
    "column",
    "relation",
  ]);
  TestValidator.equals(
    "database reference defaults",
    databaseReference.symbols,
    ["model"],
  );
  TestValidator.equals("Swagger claim defaults", swagger.symbols, [
    "operation",
  ]);

  // Root, claim, and reference levels resolve in order without mutating input.
  TestValidator.equals(
    "inherited root severity",
    programming.severity,
    "warning",
  );
  TestValidator.equals(
    "inherited reference severity",
    markdownReference.severity,
    "warning",
  );
  TestValidator.equals(
    "reference override severity",
    programmingReference.severity,
    "error",
  );
  TestValidator.equals("authored root severity", config.severity, "warning");
  TestValidator.equals(
    "authored omitted claim selector",
    config.claims[0]?.symbol,
    undefined,
  );

  // A claim can override the root default, while an inherited root off removes the claim.
  const rootOff = createEvidenceConfigPlan({
    severity: "off",
    claims: [
      {
        type: "typescript",
        severity: "error",
        files: ["included/**"],
        reference: { type: "markdown", files: ["included-docs/**"] },
      },
      {
        type: "typescript",
        files: ["inherited-off/**"],
        reference: { type: "markdown", files: ["inherited-off-docs/**"] },
      },
    ],
  });

  TestValidator.equals(
    "root severity override",
    rootOff.claims.map((claim) => claim.index),
    [0],
  );
}
