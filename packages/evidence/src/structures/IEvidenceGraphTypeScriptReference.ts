import type { EvidenceGraphTypeScriptSymbol } from "../typings/EvidenceGraphTypeScriptSymbol";

/**
 * A population of TypeScript evidence that the owning claim must cite.
 *
 * An exported symbol expresses a contract that a program can check
 * mechanically. Treating selected symbols as graph nodes lets a claim point to
 * a named type, callable, or property instead of citing a file as
 * undifferentiated implementation.
 *
 * The selection keeps the evidence graph deliberate. It can cover public types
 * by default, then opt into functions or properties only where their individual
 * contracts deserve documentary proof.
 */
export interface IEvidenceGraphTypeScriptReference {
  /** Identifies the evidence artifacts as TypeScript. */
  type: "typescript";

  /**
   * Project-relative glob patterns for candidate TypeScript files in the active
   * `ttsc` project. A matching file outside the project's `tsconfig` program is
   * not available to the rule and does not count as a match.
   *
   * These are globs, not regular expressions. `*` matches within one path
   * segment, `**` crosses any number of path segments, and `?` matches one
   * character. Both `/` and `\` are accepted as separators, while path identity
   * remains case-sensitive on every operating system.
   *
   * Patterns are evaluated from left to right. A pattern prefixed with `!`
   * removes its matches; a later positive pattern can include them again. The
   * array must contain at least one positive pattern.
   *
   * For example, `src/**` selects the complete source subtree, while
   * `scripts/check-?.ts` selects `check-a.ts` but not `check-ab.ts`.
   *
   * A bare directory such as `src` or `src/` does not include its children;
   * write `src/**` when the whole subtree belongs to this reference.
   */
  files: string[];

  /**
   * Symbol kind or kinds eligible to become evidence units.
   *
   * Omit this property to select exported interfaces, type aliases, and
   * namespaces. A single value selects one obligation kind; a non-empty array
   * selects the union. Selected units remain independent obligations until an
   * ancestor type or namespace target acknowledges their shared scope.
   * Ancestors of selected units are addressable even when their own kind is
   * omitted from this selector.
   *
   * The exact declaration forms and qualified target identities are documented
   * by {@link EvidenceGraphTypeScriptSymbol}. This is unlike a claim's `symbol`,
   * which selects declaration hosts: a reference's symbol array expands the
   * evidence units one obligation covers.
   *
   * @default type
   */
  symbol?: EvidenceGraphTypeScriptSymbol | EvidenceGraphTypeScriptSymbol[];
}
