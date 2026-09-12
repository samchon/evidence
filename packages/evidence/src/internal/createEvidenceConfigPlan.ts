import { resolve } from "node:path";

import type { IEvidenceClaim } from "../structures/IEvidenceClaim";
import type { IEvidenceConfig } from "../structures/IEvidenceConfig";
import type { IEvidenceConfigPlan } from "../structures/IEvidenceConfigPlan";
import type { IEvidenceConfigPlanClaim } from "../structures/IEvidenceConfigPlanClaim";
import type { IEvidenceConfigPlanReference } from "../structures/IEvidenceConfigPlanReference";
import type { IEvidenceReference } from "../structures/IEvidenceReference";
import type { EvidenceActiveSeverity } from "../typings/EvidenceActiveSeverity";
import type { EvidenceSeverity } from "../typings/EvidenceSeverity";
import type { EvidenceSymbol } from "../typings/EvidenceSymbol";
import { validateEvidenceConfig } from "./validateEvidenceConfig";

/** Validates every declaration before removing populations that need no artifacts. */
export function createEvidenceConfigPlan(
  config: IEvidenceConfig,
  configFile?: string,
): IEvidenceConfigPlan {
  const filename = configFile ?? resolve("evidence.config.ts");
  validateEvidenceConfig(config, filename);
  const rootSeverity = config.severity ?? "error";
  const claims: IEvidenceConfigPlanClaim[] = [];

  config.claims.forEach((claim, index) => {
    const severity = claim.severity ?? rootSeverity;
    if (claim.disabled === true || severity === "off") return;

    const references = referenceList(claim).flatMap(
      (reference, referenceIndex): IEvidenceConfigPlanReference[] => {
        const referenceSeverity = reference.severity ?? severity;
        if (referenceSeverity === "off") return [];
        return [
          {
            index: referenceIndex,
            population: structuredClone(reference),
            severity: active(referenceSeverity),
            symbols: symbols(reference, true),
          },
        ];
      },
    );
    if (references.length === 0) return;

    claims.push({
      index,
      population: structuredClone(claim),
      severity: active(severity),
      symbols: symbols(claim, false),
      references,
    });
  });
  return { configFile: filename, claims };
}

function active(severity: EvidenceSeverity): EvidenceActiveSeverity {
  if (severity === "off")
    throw new Error(
      "An inactive severity cannot enter the Evidence config plan.",
    );
  return severity;
}

function referenceList(claim: IEvidenceClaim): IEvidenceReference[] {
  return Array.isArray(claim.reference) ? claim.reference : [claim.reference];
}

function symbols(
  population: IEvidenceClaim | IEvidenceReference,
  reference: boolean,
): EvidenceSymbol[] {
  if (population.symbol !== undefined)
    return Array.isArray(population.symbol)
      ? [...population.symbol]
      : [population.symbol];
  if (population.type === "markdown") return ["file", "h1", "h2", "h3", "h4"];
  if (population.type === "swagger") return ["operation"];
  if (DATABASE_TYPES.has(population.type))
    return reference ? ["model"] : ["model", "column", "relation"];
  return reference ? ["type"] : ["type", "function", "property"];
}

const DATABASE_TYPES = new Set([
  "prisma",
  "sql",
  "postgresql",
  "mysql",
  "sqlite",
  "bigquery",
  "dbml",
]);
