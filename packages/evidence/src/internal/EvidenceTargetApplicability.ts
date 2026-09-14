import path from "node:path";

import { EvidenceFileTarget } from "../targets/EvidenceFileTarget";
import { EvidenceLanguageRegistry } from "../parsers/EvidenceLanguageRegistry";
import type { IEvidenceAddress } from "../structures/IEvidenceAddress";
import type { IEvidenceHost } from "../structures/IEvidenceHost";
import type { IEvidenceTargetStatement } from "../structures/IEvidenceTargetStatement";
import type { EvidenceDatabaseType } from "../typings/EvidenceDatabaseType";
import type { EvidenceProgrammingType } from "../typings/EvidenceProgrammingType";
import type { IEvidenceMaterializedReference } from "./IEvidenceMaterializedReference";
import { MarkdownTarget } from "../adapters/markdown/MarkdownTarget";

/**
 * Chooses reference populations that can interpret an authored target.
 *
 * The scoring is conservative: when no grammar signal distinguishes references,
 * the declaration remains available to all of them rather than losing a valid acknowledgement.
 */
export namespace EvidenceTargetApplicability {
  /** Returns the highest-affinity references while preserving configuration order. */
  export function select(
    statement: IEvidenceTargetStatement,
    host: IEvidenceHost,
    references: IEvidenceMaterializedReference[],
  ): IEvidenceMaterializedReference[] {
    if (statement.target.startsWith("prisma:"))
      return references.filter(
        (entry) => entry.plan.population.type === "prisma",
      );
    if (swaggerLike(statement.target))
      return references.filter(
        (entry) => entry.plan.population.type === "swagger",
      );

    const scores = references.map((reference) => ({
      reference,
      score: affinity(statement.target, host, reference),
    }));
    const maximum = Math.max(0, ...scores.map((entry) => entry.score));
    if (maximum > 1)
      return scores
        .filter((entry) => entry.score === maximum)
        .map((entry) => entry.reference);
    if (references.length === 1) return [...references];

    const positive = scores
      .filter((entry) => entry.score > 0)
      .map((entry) => entry.reference);
    return positive.length === 0 ? [...references] : positive;
  }
}

/** Scores a target by exact inventory file, recognizable grammar, and artifact spelling. */
function affinity(
  target: string,
  host: IEvidenceHost,
  reference: IEvidenceMaterializedReference,
): number {
  const type = reference.plan.population.type;
  if (type === "prisma" || type === "swagger") return 0;
  if (type === "markdown") {
    let file: string;
    try {
      file = MarkdownTarget.parse(target).file;
    } catch {
      return 0;
    }
    const exact = reference.inventory.sources.some((source) =>
      source.addresses.some(
        (address) =>
          address.selected !== false &&
          MarkdownTarget.normalize(address.relative) === file,
      ),
    );
    return exact ? 3 : markdownLike(file) ? 2 : 1;
  }

  const parsed = parseFileTargets(target, host);
  if (parsed.length !== 0) {
    const exact = reference.inventory.sources.some((source) =>
      source.addresses.some(
        (address) =>
          address.selected !== false &&
          parsed.some(
            (targetAddress) =>
              EvidenceFileTarget.normalize(address.absolute) ===
              EvidenceFileTarget.normalize(targetAddress.file),
          ),
      ),
    );
    if (exact) return 3;
  }
  return isParsedType(type) && recognizes(type, targetFile(target)) ? 2 : 0;
}

/** Parses against every retained host origin because a physical host can have several logical paths. */
function parseFileTargets(
  target: string,
  host: IEvidenceHost,
): IEvidenceAddress[] {
  const output: IEvidenceAddress[] = [];
  for (const origin of host.origins ?? [host.file])
    try {
      output.push(EvidenceFileTarget.parse(target, origin));
    } catch {
      continue;
    }
  return output;
}

/** Checks registry recognition without leaking parser-selection failures into affinity scoring. */
function recognizes(
  type: EvidenceProgrammingType | EvidenceDatabaseType,
  file: string,
): boolean {
  try {
    EvidenceLanguageRegistry.select(type, file);
    return true;
  } catch {
    return false;
  }
}

/** Narrows types backed by the registry, excluding document artifacts with separate target grammars. */
function isParsedType(
  type: string,
): type is EvidenceProgrammingType | EvidenceDatabaseType {
  return [
    ...EvidenceLanguageRegistry.list(),
    ...EvidenceLanguageRegistry.databases(),
  ].some((entry) => entry.type === type);
}

/** Extracts a decodable file portion; malformed escapes retain a harmless basename. */
function targetFile(target: string): string {
  const hash = target.indexOf("#");
  const encoded = hash < 0 ? target : target.slice(0, hash);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return path.basename(encoded);
  }
}

/** Identifies conventional Markdown names when no exact selected source is known. */
function markdownLike(file: string): boolean {
  return /\.(?:md|markdown|mdx)$/iu.test(file);
}

/** Recognizes API operation spelling before a Swagger reference can parse it. */
function swaggerLike(target: string): boolean {
  const match = /^([^:\s/]+):\//u.exec(target);
  const method = match?.[1];
  return (
    (method !== undefined && !/^[A-Za-z]$/u.test(method)) ||
    /^(?:GET|PUT|POST|DELETE|OPTIONS|HEAD|PATCH|TRACE)(?::|\s)/iu.test(target)
  );
}
