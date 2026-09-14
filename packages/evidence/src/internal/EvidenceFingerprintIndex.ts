import { createHash } from "node:crypto";

import type { IEvidenceFingerprint } from "../structures/IEvidenceFingerprint";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";
import type { IEvidenceUnit } from "../structures/IEvidenceUnit";
import { InventoryMerge } from "./InventoryMerge";

const VERSION = 1;
const PRESENTED_LENGTH = 7;

/** Memoizes unit content digests and selector-independent scope fingerprints. */
export class EvidenceFingerprintIndex {
  private readonly annotations = new Map<string, IEvidenceSourceRange[]>();
  private readonly children = new Map<string, IEvidenceUnit[]>();
  private readonly contentDigests = new Map<string, string>();
  private readonly fingerprints = new Map<string, IEvidenceFingerprint>();
  private readonly sources = new Map<string, IEvidenceSourceFile>();
  private readonly units = new Map<string, IEvidenceUnit>();

  public constructor(inventory: IEvidenceInventory) {
    for (const source of inventory.sources)
      this.sources.set(source.physicalPath, source);
    for (const annotation of inventory.annotationRanges) {
      if (annotation.range === undefined) continue;
      const ranges = this.annotations.get(annotation.file) ?? [];
      ranges.push(annotation.range);
      this.annotations.set(annotation.file, ranges);
    }
    for (const ranges of this.annotations.values()) ranges.sort(compareRanges);
    for (const unit of inventory.units) {
      if (this.units.has(unit.id)) continue;
      this.units.set(unit.id, unit);
      if (unit.parentId === undefined) continue;
      const children = this.children.get(unit.parentId) ?? [];
      children.push(unit);
      this.children.set(unit.parentId, children);
    }
  }

  public inspect(unitId: string): IEvidenceFingerprint {
    const remembered = this.fingerprints.get(unitId);
    if (remembered !== undefined) return remembered;
    const root = this.units.get(unitId);
    if (root === undefined)
      throw new Error(
        `Cannot fingerprint unknown semantic identity: ${unitId}`,
      );
    const scope = this.collect(root).sort((x, y) => {
      const identity = InventoryMerge.compare(x.id, y.id);
      if (identity !== 0) return identity;
      const symbol = InventoryMerge.compare(x.symbol, y.symbol);
      return symbol !== 0
        ? symbol
        : InventoryMerge.compare(this.contentDigest(x), this.contentDigest(y));
    });
    const hash = createHash("sha256");
    hash.update(`@wrtnlabs/evidence:fingerprint:${VERSION}\0`);
    for (const unit of scope) {
      hash.update(unit.id);
      hash.update("\0");
      hash.update(unit.symbol);
      hash.update("\0");
      hash.update(this.contribution(unit));
      hash.update("\0");
    }
    const scopeDigest = hash.digest("hex");
    const output: IEvidenceFingerprint = {
      version: VERSION,
      unitId,
      contentDigest: this.contentDigest(root),
      scopeDigest,
      fingerprint: scopeDigest.slice(0, PRESENTED_LENGTH),
    };
    this.fingerprints.set(unitId, output);
    return output;
  }

  private collect(root: IEvidenceUnit): IEvidenceUnit[] {
    const output: IEvidenceUnit[] = [];
    const queue: IEvidenceUnit[] = [root];
    const visited = new Set<string>();
    for (let index = 0; index < queue.length; ++index) {
      const unit = queue[index];
      if (unit === undefined || visited.has(unit.id)) continue;
      visited.add(unit.id);
      output.push(unit);
      queue.push(...(this.children.get(unit.id) ?? []));
    }
    return output;
  }

  private contribution(unit: IEvidenceUnit): string {
    const withdrawals = InventoryMerge.unique(
      unit.withdrawals.map((withdrawal) => withdrawal.tag),
      (tag) => tag,
    );
    return withdrawals.length === 0
      ? this.contentDigest(unit)
      : `${this.contentDigest(unit)}\0withdrawn:${withdrawals.join(",")}`;
  }

  private contentDigest(unit: IEvidenceUnit): string {
    if (unit.contentDigest !== undefined) return unit.contentDigest;
    const remembered = this.contentDigests.get(unit.id);
    if (remembered !== undefined) return remembered;
    const parts: string[] = [];
    const sites = [...unit.sites].sort((x, y) =>
      InventoryMerge.compare(
        JSON.stringify([
          x.file,
          x.range.start.offset,
          x.range.end.offset,
          x.id,
        ]),
        JSON.stringify([
          y.file,
          y.range.start.offset,
          y.range.end.offset,
          y.id,
        ]),
      ),
    );
    for (const site of sites) {
      const source = this.sources.get(site.file);
      if (source === undefined)
        throw new Error(
          `Cannot fingerprint missing source snapshot: ${site.file}`,
        );
      const content = [...site.content]
        .sort(compareRanges)
        .map((range) => this.withoutAnnotations(source, range));
      parts.push(normalize(content.join("\n")));
    }
    const digest = createHash("sha256")
      .update(normalize(parts.join("\0")))
      .digest("hex");
    this.contentDigests.set(unit.id, digest);
    return digest;
  }

  private withoutAnnotations(
    source: IEvidenceSourceFile,
    range: IEvidenceSourceRange,
  ): string {
    let cursor = range.start.offset;
    const fragments: string[] = [];
    for (const annotation of this.annotations.get(source.physicalPath) ?? []) {
      if (
        annotation.end.offset <= cursor ||
        annotation.start.offset >= range.end.offset
      )
        continue;
      const start = Math.max(cursor, annotation.start.offset);
      const end = Math.min(range.end.offset, annotation.end.offset);
      if (start > cursor) fragments.push(source.content.slice(cursor, start));
      cursor = Math.max(cursor, end);
    }
    if (cursor < range.end.offset)
      fragments.push(source.content.slice(cursor, range.end.offset));
    return fragments.join("");
  }
}

function compareRanges(
  x: IEvidenceSourceRange,
  y: IEvidenceSourceRange,
): number {
  const start = x.start.offset - y.start.offset;
  return start !== 0 ? start : x.end.offset - y.end.offset;
}

function normalize(text: string): string {
  const lines = text
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/u, ""));
  while (lines.at(-1) === "") lines.pop();
  return lines.join("\n");
}
