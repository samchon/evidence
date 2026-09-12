import { resolve } from "node:path";

import type { IEvidenceConfig } from "../structures/IEvidenceConfig";
import type { IEvidenceReference } from "../structures/IEvidenceReference";
import { EvidenceArtifactTypes } from "./EvidenceArtifactTypes";
import { FileGlob } from "./FileGlob";
import { SourcePath } from "./SourcePath";
import { SwaggerRemoteReader } from "./SwaggerRemoteReader";

/** Rejects invalid populations and policies before activation can suppress them. */
export function validateEvidenceConfig(
  config: IEvidenceConfig,
  configFile: string = resolve("evidence.config.ts"),
): void {
  const problems: string[] = [];
  if (config.claims.length === 0)
    problems.push(
      "claims: at least one claim is required; an empty graph cannot establish evidence coverage.",
    );
  config.claims.forEach((claim, claimIndex) => {
    const claimPath = `claims[${claimIndex}]`;
    validateArtifactType(problems, `${claimPath}.type`, claim.type);
    validateRoot(problems, `${claimPath}.root`, configFile, claim.root);
    validateGlobs(problems, `${claimPath}.files`, claim.files);
    validateSymbols(problems, `${claimPath}.symbol`, claim.symbol);
    if (claim.evidenceExcludeCarriers !== undefined)
      validateGlobs(
        problems,
        `${claimPath}.evidenceExcludeCarriers`,
        claim.evidenceExcludeCarriers,
      );

    const references: IEvidenceReference[] = Array.isArray(claim.reference)
      ? claim.reference
      : [claim.reference];
    if (references.length === 0)
      problems.push(
        `${claimPath}.reference: an empty array creates no coverage obligation; provide at least one evidence reference.`,
      );
    references.forEach((reference, referenceIndex) => {
      const base = Array.isArray(claim.reference)
        ? `${claimPath}.reference[${referenceIndex}]`
        : `${claimPath}.reference`;
      validateArtifactType(problems, `${base}.type`, reference.type);
      validateRoot(problems, `${base}.root`, configFile, reference.root);
      validateSymbols(problems, `${base}.symbol`, reference.symbol);
      if (reference.type === "swagger")
        validateSwaggerSource(problems, `${base}.file`, reference.file);
      else validateGlobs(problems, `${base}.files`, reference.files);

      if (reference.type !== "markdown" && "checklist" in reference)
        problems.push(
          `${base}.checklist: only a Markdown reference can be a checklist; a ${reference.type} population has no Markdown reading hierarchy.`,
        );
      if (reference.type !== "markdown" || reference.checklist !== true) return;
      if (reference.uniqueEvidence === true)
        problems.push(
          `${base}: checklist and uniqueEvidence cannot both hold; a checklist requires every host to answer every item while uniqueEvidence permits at most one host per item.`,
        );
      if (reference.singleEvidencePerSymbol === true)
        problems.push(
          `${base}: checklist and singleEvidencePerSymbol cannot both hold; a checklist requires every item while singleEvidencePerSymbol requires exactly one item per host.`,
        );
      if (
        (claim.evidenceExcludeCarriers?.length ?? 0) !== 0 &&
        reference.noEvidenceExclude !== true
      )
        problems.push(
          `${claimPath}.evidenceExcludeCarriers: ${base} makes every acknowledgement one host's own answer, so it cannot gather checklist exclusions into shared carriers. Drop the carriers, drop checklist, or set noEvidenceExclude on that reference.`,
        );
    });
  });
  if (problems.length !== 0)
    throw new Error(
      [
        "Invalid Evidence configuration:",
        ...problems.map((item) => `- ${item}`),
      ].join("\n"),
    );
}

function validateArtifactType(
  problems: string[],
  path: string,
  type: string,
): void {
  if (EvidenceArtifactTypes.isSupported(type)) return;
  problems.push(
    `${path}: artifact type '${type}' has no certified Evidence adapter. Supported types: ${EvidenceArtifactTypes.supported().join(", ")}.`,
  );
}

function validateGlobs(
  problems: string[],
  path: string,
  patterns: string[],
): void {
  try {
    new FileGlob(patterns);
  } catch (cause) {
    problems.push(`${path}: ${message(cause)}`);
  }
}

function validateRoot(
  problems: string[],
  path: string,
  configFile: string,
  root: string | undefined,
): void {
  if (root === undefined) return;
  try {
    SourcePath.root(configFile, root);
  } catch (cause) {
    problems.push(`${path}: ${message(cause)}`);
  }
}

function validateSymbols(
  problems: string[],
  path: string,
  symbol: string | string[] | undefined,
): void {
  if (Array.isArray(symbol) && symbol.length === 0)
    problems.push(
      `${path}: an empty symbol array selects no evidence units or declaration hosts.`,
    );
}

function validateSwaggerSource(
  problems: string[],
  path: string,
  file: string,
): void {
  try {
    if (file === "" || file.trim() !== file)
      throw new Error("A Swagger source must not be empty or padded.");
    if (SwaggerRemoteReader.parse(file) !== undefined) return;
    SourcePath.resolve(".", file);
    const normalized = file.replaceAll("\\", "/");
    if (
      normalized.endsWith("/") ||
      normalized === "." ||
      normalized === ".." ||
      normalized === "/" ||
      normalized.endsWith("/..") ||
      /^[A-Za-z]:$/u.test(normalized)
    )
      throw new Error(
        "A Swagger reference names one exact document, not a directory.",
      );
  } catch (cause) {
    problems.push(`${path}: ${message(cause)}`);
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
