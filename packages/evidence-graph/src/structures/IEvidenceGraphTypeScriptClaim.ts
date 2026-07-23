import type { EvidenceGraphTypeScriptSymbol } from "../typings/EvidenceGraphTypeScriptSymbol";
import type { IEvidenceGraphReference } from "./IEvidenceGraphReference";

/**
 * A population of TypeScript declarations claiming its referenced evidence.
 *
 * JSDoc puts an evidence edge on the public declaration making the claim,
 * rather than on the file around it. Supported hosts are the exported types and
 * top-level callables, plus the public class and namespace forms documented by
 * {@link EvidenceGraphTypeScriptSymbol}.
 *
 * Both `@evidence <target> <reason>` and `@evidenceExclude <target> <reason>`
 * require a target and a non-empty explanation. An exclusion can move between
 * eligible declarations without changing which evidence unit this claim
 * excludes.
 */
export interface IEvidenceGraphTypeScriptClaim {
  /** Identifies the claiming artifacts as TypeScript. */
  type: "typescript";

  /**
   * Optional human-readable label shown with diagnostics for this claim. It
   * does not identify evidence nodes or establish relationships between
   * configuration entries.
   */
  name?: string;

  /**
   * Project-relative glob patterns for TypeScript files in the active `ttsc`
   * project that must cite the referenced evidence. A matching file outside the
   * project's `tsconfig` program is not available to the rule and does not
   * count as a match.
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
   * write `src/**` when the whole subtree belongs to this claim.
   */
  files: string[];

  /**
   * TypeScript symbol kind or kinds eligible to host this claim's declarations.
   *
   * Omit this property to select exported type, function, and property symbols.
   * A single value selects one kind; a non-empty array selects the union of its
   * kinds. A JSDoc block on an unsupported or unexported declaration does not
   * satisfy the claim.
   *
   * @default ["type", "function", "property"]
   */
  symbol?: EvidenceGraphTypeScriptSymbol | EvidenceGraphTypeScriptSymbol[];

  /**
   * One evidence population or independently complete evidence populations that
   * this claim must cite.
   *
   * A single reference requires this claim's files to acknowledge every
   * evidence unit it materializes. An array creates a separate 100% obligation
   * for every element: acknowledgements toward one reference never count toward
   * another, and partially covered references cannot be pooled. The array must
   * not be empty.
   */
  reference: IEvidenceGraphReference | IEvidenceGraphReference[];
}
