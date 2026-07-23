import type { EvidenceGraphTypeScriptSymbol } from "../typings/EvidenceGraphTypeScriptSymbol";
import type { IEvidenceGraphReference } from "./IEvidenceGraphReference";

/**
 * A configured body of TypeScript evidence.
 *
 * An exported symbol expresses a contract that a program can check
 * mechanically. Treating selected symbols as graph nodes lets a document or
 * another declaration point to the exact contract it relies on instead of
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
   * Project-relative glob patterns for candidate TypeScript files.
   *
   * These are globs, not regular expressions. `*` matches within one path
   * segment, `**` crosses any number of path segments, and `?` matches one
   * character.
   *
   * Examples:
   *
   * - `packages/*\/src/**\/*.ts` selects source files in every package.
   * - `tests/*\/src/**\/*.ts` selects source fixtures in every test package.
   * - `scripts/check-?.ts` selects one-character suffixed check scripts.
   *
   * A bare directory such as `src` or `src/` does not include its children;
   * write `src/**` when the whole subtree belongs to this source group.
   */
  files: string[];

  /**
   * Symbol kind or kinds eligible to become evidence units.
   *
   * Omit this property to select exported interfaces and type aliases. A single
   * value selects one kind; an array selects the union of its kinds. This is
   * unlike `reference`: a symbol array expands one source's evidence units,
   * whereas a reference array creates independently complete coverage
   * obligations.
   *
   * @default type
   */
  symbol?: EvidenceGraphTypeScriptSymbol | EvidenceGraphTypeScriptSymbol[];

  /**
   * One file group or independently complete file groups that must acknowledge
   * this source.
   *
   * A single reference requires its matching files to acknowledge every
   * evidence unit here. An array creates a separate 100% obligation for every
   * element: acknowledgements in one group never count toward another, and
   * partially covered groups cannot be pooled to satisfy this source.
   */
  reference: IEvidenceGraphReference | IEvidenceGraphReference[];
}
