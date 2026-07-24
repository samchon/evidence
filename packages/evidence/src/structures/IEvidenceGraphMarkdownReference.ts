import type { EvidenceGraphMarkdownSymbol } from "../typings/EvidenceGraphMarkdownSymbol";

/**
 * A population of documentary evidence that the owning claim must cite.
 *
 * A document is useful as evidence only when a reviewer can identify the scope
 * that supports a claim. This reference makes the obligation levels explicit
 * while allowing one file or heading target to acknowledge its selected
 * descendants. Citations remain anchored in the outline, so an editorial change
 * cannot silently preserve a claim whose grounds disappeared.
 */
export interface IEvidenceGraphMarkdownReference {
  /** Identifies the evidence artifacts as Markdown. */
  type: "markdown";

  /**
   * Project-relative glob patterns for Markdown documents in this evidence
   * population. Every matching regular file is parsed as Markdown regardless of
   * extension, so exclude images and other non-Markdown assets from the
   * patterns.
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
   * For example, `docs/*.md` selects Markdown files directly under `docs`,
   * while `specs/v?.md` selects names such as `v1.md` but not `v10.md`.
   *
   * A bare directory such as `docs` or `docs/` does not include its children;
   * write `docs/**` when the whole subtree belongs to this reference.
   */
  files: string[];

  /**
   * Markdown node kind or kinds eligible to become evidence units.
   *
   * Omit this property to select documents and H1 through H4 sections. A single
   * value selects one obligation kind; a non-empty array selects the union.
   * Selected units remain independent obligations until an ancestor target
   * acknowledges their shared scope. Ancestors of selected units are
   * addressable even when their own kind is omitted from this selector.
   *
   * File units use the project-relative path as their target. Heading units use
   * `<path>#<anchor>` as documented by {@link EvidenceGraphMarkdownSymbol}.
   *
   * @default ["file", "h1", "h2", "h3", "h4"]
   */
  symbol?: EvidenceGraphMarkdownSymbol | EvidenceGraphMarkdownSymbol[];
}
