import type { TtscLintSeverity } from "@ttsc/lint";

/**
 * A population of TypeScript declarations that must acknowledge the owning
 * source.
 *
 * JSDoc puts an evidence edge on the declaration making the claim, rather than
 * on the file around it. This preserves the reason for a particular exported
 * contract even when nearby declarations evolve independently.
 */
export interface IEvidenceGraphTypeScriptReference {
  /** Identifies the citing artifacts as TypeScript. */
  type: "typescript";

  /**
   * Project-relative glob patterns for TypeScript files that must cite the
   * owning evidence source.
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
   * write `src/**` when the whole subtree belongs to this reference group.
   */
  files: string[];

  /**
   * Optional severity for this reference group. It overrides the owning
   * source's severity only here.
   */
  severity?: TtscLintSeverity;
}
