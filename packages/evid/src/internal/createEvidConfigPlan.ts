import { resolve } from "node:path";

import { EvidLanguageRegistry } from "../parsers/EvidLanguageRegistry";

import type { IEvidClaim } from "../structures/IEvidClaim";
import type { IEvidConfig } from "../structures/IEvidConfig";
import type { IEvidConfigPlan } from "../structures/IEvidConfigPlan";
import type { IEvidConfigPlanClaim } from "../structures/IEvidConfigPlanClaim";
import type { IEvidConfigPlanReference } from "../structures/IEvidConfigPlanReference";
import type { IEvidReference } from "../structures/IEvidReference";
import type { EvidActiveSeverity } from "../typings/EvidActiveSeverity";
import type { EvidSeverity } from "../typings/EvidSeverity";
import type { EvidSymbol } from "../typings/EvidSymbol";
import { validateEvidConfig } from "./validateEvidConfig";

/**
 * Validates configuration and derives the immutable enabled-analysis plan.
 *
 * Validation precedes filtering so a disabled or off entry cannot hide an
 * invalid declaration. The plan clones populations to prevent later caller
 * mutation from changing an in-progress graph evaluation.
 */
export function createEvidConfigPlan(
  config: IEvidConfig,
  configFile?: string,
): IEvidConfigPlan {
  const filename = configFile ?? resolve("evid.config.ts");
  validateEvidConfig(config, filename);
  const rootSeverity = config.severity ?? "error";
  const claims: IEvidConfigPlanClaim[] = [];

  config.claims.forEach((claim, index) => {
    const severity = claim.severity ?? rootSeverity;
    if (claim.disabled === true || severity === "off") return;

    const references = referenceList(claim).flatMap(
      (reference, referenceIndex): IEvidConfigPlanReference[] => {
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

/** Narrows a retained severity and defends the invariant established by plan filtering.
 *
 * Plan construction has already removed unsupported values, so this helper documents and enforces the remaining configuration contract.
 */
function active(severity: EvidSeverity): EvidActiveSeverity {
  if (severity === "off")
    throw new Error(
      "An inactive severity cannot enter the Evid config plan.",
    );
  return severity;
}

/** Normalizes singular and plural reference syntax without changing reference order.
 *
 * Later plan consumers preserve that order when resolving target applicability and reporting configuration results.
 */
function referenceList(claim: IEvidClaim): IEvidReference[] {
  return Array.isArray(claim.reference) ? claim.reference : [claim.reference];
}

/** Applies artifact defaults only when configuration did not explicitly select symbols.
 *
 * An explicit empty or narrowed symbol selection is never replaced by the artifact's broad default population.
 */
function symbols(
  population: IEvidClaim | IEvidReference,
  reference: boolean,
): EvidSymbol[] {
  if (population.symbol !== undefined)
    return Array.isArray(population.symbol)
      ? [...population.symbol]
      : [population.symbol];
  if (population.type === "markdown") return ["file", "h1", "h2", "h3", "h4"];
  if (population.type === "swagger") return ["operation"];
  if (DATABASE_TYPES.has(population.type))
    return reference ? ["model"] : ["model", "column", "relation"];
  const supported: EvidSymbol[] = EvidLanguageRegistry.list().find(
    (language) => language.type === population.type,
  )?.adapter?.symbols ?? ["type", "function", "property"];
  return reference && supported.includes("type") ? ["type"] : [...supported];
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
