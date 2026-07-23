import type { EvidenceGraphMarkdownSymbol } from "../typings/EvidenceGraphMarkdownSymbol";
import type { IEvidenceGraphReference } from "./IEvidenceGraphReference";

/**
 * A population of Markdown documents claiming its referenced evidence.
 *
 * Markdown uses HTML comments as invisible but reviewable declaration hosts.
 * Both `@evidence <target> <reason>` and `@evidenceExclude <target> <reason>`
 * require a target and a non-empty explanation.
 *
 * An exclusion still has to appear in a selected claim file and on a selected
 * host kind. Its particular host is not part of the acknowledgement identity,
 * so moving it between eligible sections cannot change the target scope this
 * claim excludes. The target scope, not the declaration's host position,
 * determines which selected descendants are acknowledged.
 *
 * @example
 *   <!-- @evidence docs/orders.md#create-order This section adopts the creation contract. -->
 */
export interface IEvidenceGraphMarkdownClaim {
  /** Identifies the claiming artifacts as Markdown. */
  type: "markdown";

  /**
   * Optional human-readable label shown with diagnostics for this claim. It
   * does not identify evidence nodes or establish relationships between
   * configuration entries.
   */
  name?: string;

  /**
   * Project-relative glob patterns for Markdown files that must cite the
   * referenced evidence. Every matching regular file is parsed as Markdown
   * regardless of extension, so exclude non-Markdown assets.
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
   * write `docs/**` when the whole subtree belongs to this claim.
   */
  files: string[];

  /**
   * Markdown node kind or kinds eligible to host this claim's declarations.
   *
   * Omit this property to select documents and H1 through H4 sections. A single
   * value selects one kind; a non-empty array selects the union of its kinds.
   *
   * A `"file"` declaration appears before the document's first ATX heading. A
   * heading declaration belongs to the nearest preceding ATX heading, whose
   * exact level must be selected. This makes an H3 declaration distinct from
   * its enclosing H2 section.
   *
   * @default ["file", "h1", "h2", "h3", "h4"]
   */
  symbol?: EvidenceGraphMarkdownSymbol | EvidenceGraphMarkdownSymbol[];

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
