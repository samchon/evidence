import type { EvidenceGraphMarkdownSymbol } from "../typings/EvidenceGraphMarkdownSymbol";

/**
 * A population of Markdown claims that must acknowledge the owning source.
 *
 * Markdown needs an invisible but reviewable declaration host. An HTML-comment
 * `@evidence` tag attaches to a selected document or heading without polluting
 * rendered prose. `@evidenceExclude` is position-insensitive: it records an
 * intentional non-use without making its host part of graph identity.
 */
export interface IEvidenceGraphMarkdownReference {
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
   * Markdown node kind or kinds eligible to declare evidence for this source.
   *
   * Omit this property to select documents and H1 through H4 sections. A single
   * value selects one kind; an array selects the union of its kinds.
   *
   * @default ["file", "h1", "h2", "h3", "h4"]
   */
  symbol?: EvidenceGraphMarkdownSymbol | EvidenceGraphMarkdownSymbol[];
}
