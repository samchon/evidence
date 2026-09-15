import type { EvidMarkdownSymbol } from "../typings/EvidMarkdownSymbol";
import type { IEvidClaimBase } from "./IEvidClaimBase";

/**
 * Markdown documents that host evidence tags in HTML comments.
 *
 * Heading structure supplies semantic claim hosts, and comment placement assigns
 * each annotation to a file or section. Selecting an exact heading level controls
 * which subjects owe evidence without flattening nested sections into their
 * parent's identity.
 *
 * - Every matching regular file is parsed as Markdown regardless of extension.
 * - File hosts precede the first ATX heading. Section hosts belong to the nearest
 *   preceding ATX heading, whose exact level must be selected.
 * - Evid and exclusions require a target and nonempty reason.
 * - Ordinary exclusions belong to the claim's target scope, not their particular
 *   eligible host position. Markdown checklists apply per-host rules instead.
 */
export interface IEvidMarkdownClaim extends IEvidClaimBase<
  "markdown",
  EvidMarkdownSymbol
> {}
