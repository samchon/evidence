import { createHash } from "node:crypto";

import type { IEvidenceFingerprint } from "../structures/IEvidenceFingerprint";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";
import type { IEvidenceUnit } from "../structures/IEvidenceUnit";
import type { IEvidenceUnitSite } from "../structures/IEvidenceUnitSite";
import { EvidenceInventoryMerge } from "./EvidenceInventoryMerge";

const VERSION: number = 2;
const PRESENTED_LENGTH: number = 7;

/**
 * One process-local token and its checkout-stable fingerprint replacement.
 *
 * Replacement operates on the original adapter identity so generated marker
 * text can never be interpreted as another source token.
 */
type EvidencePortableReplacement = readonly [token: string, value: string];

/**
 * Computes and memoizes stable fingerprints for inventory units and
 * descendants.
 *
 * Fingerprints exclude annotation text and presentation-only whitespace so an
 * acknowledgement edit does not look like a specification change. The index
 * owns only references to the immutable analysis inventory.
 */
export class EvidenceFingerprintIndex {
  /**
   * Annotation ranges grouped by their physical source file.
   *
   * Content hashing removes these mapped spans while preserving surrounding
   * semantic source text.
   */
  private readonly annotations = new Map<string, IEvidenceSourceRange[]>();

  /**
   * Structurally owned child units grouped by parent identity.
   *
   * Subtree fingerprints traverse this index without rescanning the inventory.
   */
  private readonly children = new Map<string, IEvidenceUnit[]>();

  /**
   * Memoized content digest for each process-local unit identity.
   *
   * A single inventory snapshot owns the index, so unit IDs are safe cache keys
   * even though the resulting digest excludes them.
   */
  private readonly contentDigests = new Map<string, string>();

  /**
   * Memoized public fingerprint result for each unit identity.
   *
   * Repeated review checks reuse both the presented prefix and full scope hash.
   */
  private readonly fingerprints = new Map<string, IEvidenceFingerprint>();

  /**
   * Source snapshots indexed by physical path for site content lookup.
   *
   * Fingerprint identity is read from each snapshot's checkout-stable declaring
   * path after the physical site resolves here.
   */
  private readonly sources = new Map<string, IEvidenceSourceFile>();

  /**
   * Semantic units indexed by their process-local graph identity.
   *
   * Public callers request a unit by this ID before hashing replaces it with a
   * portable declaration identity.
   */
  private readonly units = new Map<string, IEvidenceUnit>();

  /**
   * Builds source, annotation, and parent indexes once for one inventory
   * snapshot.
   *
   * Fingerprint generation reuses these indexes to connect units to their
   * physical content without repeatedly scanning inventory collections.
   */
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

  /**
   * Returns the root content digest and subtree scope digest for one semantic
   * identity.
   *
   * Unknown identities fail rather than producing an empty fingerprint, because
   * absence would make a stale graph appear unchanged.
   */
  public inspect(unitId: string): IEvidenceFingerprint {
    const remembered = this.fingerprints.get(unitId);
    if (remembered !== undefined) return remembered;
    const root = this.units.get(unitId);
    if (root === undefined)
      throw new Error(
        `Cannot fingerprint unknown semantic identity: ${unitId}`,
      );
    const scope: IEvidenceUnit[] = this.collect(root).sort(
      (x: IEvidenceUnit, y: IEvidenceUnit): number => {
        const identity: number = EvidenceInventoryMerge.compare(
          this.identity(x),
          this.identity(y),
        );
        if (identity !== 0) return identity;
        const symbol: number = EvidenceInventoryMerge.compare(x.symbol, y.symbol);
        return symbol !== 0
          ? symbol
          : EvidenceInventoryMerge.compare(
              this.contentDigest(x),
              this.contentDigest(y),
            );
      },
    );
    const hash = createHash("sha256");
    hash.update(`evid:fingerprint:${VERSION}\0`);
    for (const unit of scope) {
      hash.update(this.identity(unit));
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

  /**
   * Describes a semantic declaration without process-local source or site IDs.
   *
   * Each adapter's unit ID already decides whether a file, package, library, or
   * schema owns semantic identity. Rewriting its physical tokens preserves that
   * boundary: file-scoped declarations keep a portable path, while database
   * declarations designed to survive file moves do not acquire a new one.
   */
  private identity(unit: IEvidenceUnit): string {
    return JSON.stringify([
      unit.type,
      unit.type === "markdown"
        ? this.declaringPaths(unit)
        : this.portableUnitId(unit),
      unit.symbol,
      unit.identity,
    ]);
  }

  /**
   * Collects portable paths for Markdown's position-bearing unit IDs.
   *
   * Heading offsets are physical parser coordinates rather than semantic
   * identity. Markdown declarations remain file-scoped, so their declaring
   * paths replace that unstable suffix while still distinguishing equal anchors
   * in separate files.
   */
  private declaringPaths(unit: IEvidenceUnit): string[] {
    return EvidenceInventoryMerge.unique(
      unit.sites.map((site: IEvidenceUnitSite): string => {
        const source: IEvidenceSourceFile | undefined = this.sources.get(site.file);
        if (source === undefined)
          throw new Error(
            `Cannot fingerprint missing source snapshot: ${site.file}`,
          );
        return source.fingerprintPath;
      }),
      (value: string): string => value,
    ).sort(EvidenceInventoryMerge.compare);
  }

  /**
   * Rewrites one adapter-owned unit ID into checkout-stable source coordinates.
   *
   * Source IDs may contain inode data, and several language resolvers retain an
   * absolute source or module root in their semantic key. One longest-token
   * pass keeps overlapping identities independent and prevents generated
   * markers from participating in later replacements.
   */
  private portableUnitId(unit: IEvidenceUnit): string {
    const sources: IEvidenceSourceFile[] = Array.from(this.sources.values());
    const replacements: EvidencePortableReplacement[] = [];
    for (const source of sources) {
      const marker: string = `@source:${JSON.stringify(source.fingerprintPath)}`;
      replacements.push([source.id, marker]);
      replacements.push([
        source.physicalPath,
        `@file:${source.fingerprintPath}`,
      ]);
      if (source.fingerprintRoot !== undefined)
        replacements.push([
          source.fingerprintRoot.physicalPath,
          `@root:${JSON.stringify(source.fingerprintRoot.fingerprintPath)}`,
        ]);
    }
    const roots: string[] = EvidenceInventoryMerge.unique(
      sources.flatMap((source: IEvidenceSourceFile): string[] => {
        if (source.fingerprintRoot !== undefined) return [];
        const suffix: string = `/${source.fingerprintPath}`;
        return source.physicalPath.endsWith(suffix)
          ? [source.physicalPath.slice(0, -suffix.length)]
          : [];
      }),
      (value: string): string => value,
    );
    for (const root of roots)
      if (root !== "") replacements.push([root, "@root"]);
    return replacePortableTokens(unit.id, replacements);
  }

  /**
   * Collects a cycle-safe structural subtree for one unit.
   *
   * The visited set prevents malformed parent links from looping fingerprint
   * generation while preserving each reachable child once.
   */
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

  /**
   * Adds withdrawal tags to the content contribution because they alter
   * effective scope.
   *
   * A unit's fingerprint must change when a withdrawal changes which
   * declarations remain active, even if its source range is unchanged.
   */
  private contribution(unit: IEvidenceUnit): string {
    const withdrawals = EvidenceInventoryMerge.unique(
      unit.withdrawals.map((withdrawal) => withdrawal.tag),
      (tag) => tag,
    );
    return withdrawals.length === 0
      ? this.contentDigest(unit)
      : `${this.contentDigest(unit)}\0withdrawn:${withdrawals.join(",")}`;
  }

  /**
   * Hashes source sites after stripping annotations and presentation
   * differences.
   *
   * Annotation edits are tracked separately, while substantive source changes
   * remain stable across line-ending and trailing-space differences.
   */
  private contentDigest(unit: IEvidenceUnit): string {
    if (unit.contentDigest !== undefined) return unit.contentDigest;
    const remembered = this.contentDigests.get(unit.id);
    if (remembered !== undefined) return remembered;
    const parts: string[] = [];
    const sites: IEvidenceUnitSite[] = [...unit.sites].sort(
      (x: IEvidenceUnitSite, y: IEvidenceUnitSite): number => {
        const left: IEvidenceSourceFile | undefined = this.sources.get(x.file);
        const right: IEvidenceSourceFile | undefined = this.sources.get(y.file);
        const identity: number = EvidenceInventoryMerge.compare(
          left?.fingerprintPath ?? x.file,
          right?.fingerprintPath ?? y.file,
        );
        if (identity !== 0) return identity;
        const start: number = x.range.start.offset - y.range.start.offset;
        return start !== 0 ? start : x.range.end.offset - y.range.end.offset;
      },
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

  /**
   * Removes overlapping annotation spans while retaining surrounding source.
   *
   * Ranges are ordered before removal so adjacent or overlapping tags cannot
   * duplicate or erase unrelated source fragments.
   */
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

/**
 * Replaces process-local identity tokens without revisiting generated text.
 *
 * At each original input position, the longest matching token wins. Equal
 * tokens must agree on their stable value so source collection order cannot
 * choose a fingerprint silently.
 */
function replacePortableTokens(
  input: string,
  replacements: EvidencePortableReplacement[],
): string {
  const unique = new Map<string, string>();
  for (const [token, value] of replacements) {
    if (token === "") continue;
    const previous: string | undefined = unique.get(token);
    if (previous !== undefined && previous !== value)
      throw new Error(
        `Cannot fingerprint ambiguous portable token: ${JSON.stringify(token)}`,
      );
    unique.set(token, value);
  }
  const ordered: EvidencePortableReplacement[] = Array.from(unique.entries()).sort(
    (left: EvidencePortableReplacement, right: EvidencePortableReplacement): number => {
      const lengthDifference: number = right[0].length - left[0].length;
      return lengthDifference !== 0
        ? lengthDifference
        : EvidenceInventoryMerge.compare(left[0], right[0]);
    },
  );
  if (ordered.length === 0) return input;

  let output: string = "";
  let cursor: number = 0;
  while (cursor < input.length) {
    let selected: EvidencePortableReplacement | undefined;
    let selectedAt: number = -1;
    for (const candidate of ordered) {
      const found: number = input.indexOf(candidate[0], cursor);
      if (found < 0) continue;
      if (
        selected === undefined ||
        found < selectedAt ||
        (found === selectedAt && candidate[0].length > selected[0].length)
      ) {
        selected = candidate;
        selectedAt = found;
      }
    }
    if (selected === undefined) {
      output += input.slice(cursor);
      break;
    }
    output += input.slice(cursor, selectedAt) + selected[1];
    cursor = selectedAt + selected[0].length;
  }
  return output;
}

/**
 * Orders source spans by position before content fragments are concatenated.
 *
 * Stable ordering makes a fingerprint independent of adapter collection order
 * for sites in the same file.
 */
function compareRanges(x: IEvidenceSourceRange, y: IEvidenceSourceRange): number {
  const start = x.start.offset - y.start.offset;
  return start !== 0 ? start : x.end.offset - y.end.offset;
}

/**
 * Normalizes line endings and trailing whitespace without changing interior
 * source content.
 *
 * Fingerprints ignore presentation differences that do not affect the authored
 * declaration body.
 */
function normalize(text: string): string {
  const lines = text
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/u, ""));
  while (lines.at(-1) === "") lines.pop();
  return lines.join("\n");
}
