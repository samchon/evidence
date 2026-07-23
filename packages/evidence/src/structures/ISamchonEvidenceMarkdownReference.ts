import type { TtscLintSeverity } from "@ttsc/lint";

/**
 * A population of Markdown claims that must acknowledge the owning source.
 *
 * Markdown needs an invisible but reviewable attachment point. An HTML-comment
 * `@evidence` tag immediately below a heading makes the citation belong to that
 * section without polluting rendered prose. `@evidenceExclude` records the
 * opposite decision with its reason, so intentional non-use remains visible to
 * the graph.
 */
export interface ISamchonEvidenceMarkdownReference {
  /** Identifies the citing artifacts as Markdown. */
  type: "markdown";

  /**
   * Project-relative glob patterns for Markdown files that must cite the owning
   * evidence source.
   *
   * These are globs, not regular expressions. `*` matches within one path
   * segment, `**` crosses any number of path segments, and `?` matches one
   * character.
   *
   * Examples:
   *
   * - `docs/**\/*.md` selects every Markdown document below `docs`.
   * - `packages/*\/design/**\/*.md` selects design documents in every package.
   * - `specs/v?.md` selects one-character versioned specification files.
   *
   * A bare directory such as `docs` or `docs/` does not include its children;
   * write `docs/**` when the whole subtree belongs to this reference group.
   */
  files: string[];

  /**
   * Optional severity for this reference group. It overrides the owning
   * source's severity only here.
   */
  severity?: TtscLintSeverity;
}
