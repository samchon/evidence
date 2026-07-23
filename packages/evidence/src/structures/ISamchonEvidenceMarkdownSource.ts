import type { TtscLintSeverity } from "@ttsc/lint";
import type { ISamchonEvidenceHeadingRange } from "./ISamchonEvidenceHeadingRange";
import type { ISamchonEvidenceReference } from "./ISamchonEvidenceReference";

/**
 * A configured body of documentary evidence.
 *
 * A document is useful as evidence only when a reviewer can identify the
 * section that supports a claim. This source therefore treats selected heading
 * sections as graph nodes, rather than treating a passing mention of an entire
 * file as proof.
 *
 * The distinction makes documentation accountable. Coverage can expose a
 * section no artifact relies on, while citations remain narrow enough that an
 * editorial change cannot silently preserve a claim whose grounds disappeared.
 */
export interface ISamchonEvidenceMarkdownSource {
  /** Identifies this source as Markdown. */
  type: "markdown";

  /**
   * Optional human-readable label shown with diagnostics for this source. It
   * does not identify evidence nodes or establish relationships between
   * configuration entries.
   */
  name?: string;

  /**
   * Project-relative glob patterns for Markdown documents in this source.
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
   * write `docs/**` when the whole subtree belongs to this source group.
   */
  files: string[];

  /**
   * Inclusive heading range whose sections become evidence units. Both
   * endpoints are included, and `minimum` must not exceed `maximum`.
   */
  headings: ISamchonEvidenceHeadingRange;

  /**
   * One file group or independently complete file groups that must acknowledge
   * this source.
   *
   * A single reference requires its matching files to acknowledge every
   * evidence unit here. An array creates a separate 100% obligation for every
   * element: acknowledgements in one group never count toward another, and
   * partially covered groups cannot be pooled to satisfy this source.
   */
  reference: ISamchonEvidenceReference | ISamchonEvidenceReference[];

  /**
   * Optional severity for this source. It overrides
   * `ISamchonEvidenceConfig.severity`; a reference-level severity overrides
   * this value for that one reference group.
   */
  severity?: TtscLintSeverity;
}
