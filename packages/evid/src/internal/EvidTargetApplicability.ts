import path from "node:path";

import { EvidFileTarget } from "../targets/EvidFileTarget";
import { EvidLanguageRegistry } from "../parsers/EvidLanguageRegistry";
import type { IEvidAddress } from "../structures/IEvidAddress";
import type { IEvidHost } from "../structures/IEvidHost";
import type { IEvidTargetStatement } from "../structures/IEvidTargetStatement";
import type { EvidDatabaseType } from "../typings/EvidDatabaseType";
import type { EvidProgrammingType } from "../typings/EvidProgrammingType";
import type { IEvidMaterializedReference } from "./IEvidMaterializedReference";
import { EvidMarkdownTarget } from "../adapters/markdown/EvidMarkdownTarget";

/**
 * Chooses reference populations that can interpret an authored target.
 *
 * The scoring is conservative: when no grammar signal distinguishes references,
 * the declaration remains available to all of them rather than losing a valid acknowledgement.
 */
export namespace EvidTargetApplicability {
  /** Selects the highest-affinity references while preserving configuration order.
   *
   * A tag is retained for every tied viable population when syntax cannot distinguish the intended reference artifact.
   */
  export function select(
    statement: IEvidTargetStatement,
    host: IEvidHost,
    references: IEvidMaterializedReference[],
  ): IEvidMaterializedReference[] {
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

/** Scores a target by exact inventory file, recognizable grammar, and artifact spelling.
 *
 * Selection compares these scores to narrow an ambiguous target only when the available source evidence is decisive.
 */
function affinity(
  target: string,
  host: IEvidHost,
  reference: IEvidMaterializedReference,
): number {
  const type = reference.plan.population.type;
  if (type === "prisma" || type === "swagger") return 0;
  if (type === "markdown") {
    let file: string;
    try {
      file = EvidMarkdownTarget.parse(target).file;
    } catch {
      return 0;
    }
    const exact = reference.inventory.sources.some((source) =>
      source.addresses.some(
        (address) =>
          address.selected !== false &&
          EvidMarkdownTarget.normalize(address.relative) === file,
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
              EvidFileTarget.normalize(address.absolute) ===
              EvidFileTarget.normalize(targetAddress.file),
          ),
      ),
    );
    if (exact) return 3;
  }
  return isParsedType(type) && recognizes(type, targetFile(target)) ? 2 : 0;
}

/** Parses against every retained host origin because a physical host can have several logical paths.
 *
 * An exact source address may be reachable through multiple configured spellings, each of which can make a target applicable.
 */
function parseFileTargets(
  target: string,
  host: IEvidHost,
): IEvidAddress[] {
  const output: IEvidAddress[] = [];
  for (const origin of host.origins ?? [host.file])
    try {
      output.push(EvidFileTarget.parse(target, origin));
    } catch {
      continue;
    }
  return output;
}

/** Checks registry recognition without leaking parser-selection failures into affinity scoring.
 *
 * Affinity treats an unrecognized grammar spelling as no signal while adapter analysis reports actual parser failures elsewhere.
 */
function recognizes(
  type: EvidProgrammingType | EvidDatabaseType,
  file: string,
): boolean {
  try {
    EvidLanguageRegistry.select(type, file);
    return true;
  } catch {
    return false;
  }
}

/** Narrows types backed by the language registry, excluding document artifacts with separate target grammars.
 *
 * The registry lookup is valid only for programming and database artifact types.
 */
function isParsedType(
  type: string,
): type is EvidProgrammingType | EvidDatabaseType {
  return [
    ...EvidLanguageRegistry.list(),
    ...EvidLanguageRegistry.databases(),
  ].some((entry) => entry.type === type);
}

/** Extracts a decodable file portion while retaining a harmless basename for malformed escapes.
 *
 * Target affinity must not throw while inspecting incomplete authored text, because ordinary target parsing owns that diagnostic.
 */
function targetFile(target: string): string {
  const hash = target.indexOf("#");
  const encoded = hash < 0 ? target : target.slice(0, hash);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return path.basename(encoded);
  }
}

/** Identifies conventional Markdown names when no exact selected source is known.
 *
 * This supplies a weak affinity signal for Markdown references without claiming that the file exists in their inventory.
 */
function markdownLike(file: string): boolean {
  return /\.(?:md|markdown|mdx)$/iu.test(file);
}

/** Recognizes API operation spelling before a Swagger reference can parse it.
 *
 * The cheap lexical check avoids assigning Swagger affinity to ordinary path-like targets.
 */
function swaggerLike(target: string): boolean {
  const match = /^([^:\s/]+):\//u.exec(target);
  const method = match?.[1];
  return (
    (method !== undefined && !/^[A-Za-z]$/u.test(method)) ||
    /^(?:GET|PUT|POST|DELETE|OPTIONS|HEAD|PATCH|TRACE)(?::|\s)/iu.test(target)
  );
}
