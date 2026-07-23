import type { EvidenceGraphTypeScriptSymbol } from "../typings/EvidenceGraphTypeScriptSymbol";
import type { IEvidenceGraphCiter } from "./IEvidenceGraphCiter";

/**
 * A configured body of TypeScript evidence.
 *
 * An exported symbol expresses a contract that a program can check
 * mechanically. Treating selected symbols as graph nodes lets a document or
 * another declaration point to a named type, callable, or property instead of
 * citing a file as undifferentiated implementation.
 *
 * The selection keeps the evidence graph deliberate. It can cover public types
 * by default, then opt into functions or properties only where their individual
 * contracts deserve documentary proof.
 */
export interface IEvidenceGraphTypeScriptSource {
  /** Identifies this source as TypeScript. */
  type: "typescript";

  /**
   * Optional human-readable label shown with diagnostics for this source. It
   * does not identify evidence nodes or establish relationships between
   * configuration entries.
   */
  name?: string;

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
   * write `src/**` when the whole subtree belongs to this source group.
   */
  files: string[];

  /**
   * Symbol kind or kinds eligible to become evidence units.
   *
   * Omit this property to select exported interfaces and type aliases. A single
   * value selects one kind; a non-empty array selects the union of its kinds.
   * The exact declaration forms and qualified target identities are documented
   * by {@link EvidenceGraphTypeScriptSymbol}. This is unlike `citedBy`: a symbol
   * array expands one source's evidence units, whereas a citer array creates
   * independently complete coverage obligations.
   *
   * @default type
   */
  symbol?: EvidenceGraphTypeScriptSymbol | EvidenceGraphTypeScriptSymbol[];

  /**
   * One citer group or independently complete citer groups that must
   * acknowledge this source.
   *
   * A single citer group requires its matching files to acknowledge every
   * evidence unit here. An array creates a separate 100% obligation for every
   * element: acknowledgements in one group never count toward another, and
   * partially covered groups cannot be pooled to satisfy this source. The array
   * must not be empty.
   */
  citedBy: IEvidenceGraphCiter | IEvidenceGraphCiter[];
}
