import path from "node:path";

import { EvidenceFileTarget } from "../targets/EvidenceFileTarget";
import { EvidenceLanguageRegistry } from "../parsers/EvidenceLanguageRegistry";
import type { IEvidenceAddress } from "../structures/IEvidenceAddress";
import type { IEvidenceHost } from "../structures/IEvidenceHost";
import type { IEvidenceTargetStatement } from "../structures/IEvidenceTargetStatement";
import type { EvidenceProgrammingType } from "../typings/EvidenceProgrammingType";
import type { IEvidenceMaterializedReference } from "./IEvidenceMaterializedReference";
import { MarkdownTarget } from "../adapters/markdown/MarkdownTarget";

/** Assigns a declaration to references whose target grammar and files accept it. */
export namespace EvidenceTargetApplicability {
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

  const parsed = parseProgrammingTargets(target, host);
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
  return isProgrammingType(type) && recognizes(type, targetFile(target))
    ? 2
    : 0;
}

function parseProgrammingTargets(
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

function recognizes(type: EvidenceProgrammingType, file: string): boolean {
  try {
    EvidenceLanguageRegistry.select(type, file);
    return true;
  } catch {
    return false;
  }
}

function isProgrammingType(type: string): type is EvidenceProgrammingType {
  return EvidenceLanguageRegistry.list().some((entry) => entry.type === type);
}

function targetFile(target: string): string {
  const hash = target.indexOf("#");
  const encoded = hash < 0 ? target : target.slice(0, hash);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return path.basename(encoded);
  }
}

function markdownLike(file: string): boolean {
  return /\.(?:md|markdown|mdx)$/iu.test(file);
}

function swaggerLike(target: string): boolean {
  const match = /^([^:\s/]+):\//u.exec(target);
  const method = match?.[1];
  return (
    (method !== undefined && !/^[A-Za-z]$/u.test(method)) ||
    /^(?:GET|PUT|POST|DELETE|OPTIONS|HEAD|PATCH|TRACE)(?::|\s)/iu.test(target)
  );
}
