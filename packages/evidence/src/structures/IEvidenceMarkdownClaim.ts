import type { EvidenceMarkdownSymbol } from "../typings/EvidenceMarkdownSymbol";
import type { IEvidenceClaimBase } from "./IEvidenceClaimBase";

/**
 * Markdown documents that host evidence tags in HTML comments.
 *
 * - Every matching regular file is parsed as Markdown regardless of extension.
 * - File hosts precede the first ATX heading. Section hosts belong to the nearest
 *   preceding ATX heading, whose exact level must be selected.
 * - Evidence and exclusions require a target and nonempty reason.
 * - Ordinary exclusions belong to the claim's target scope, not their particular
 *   eligible host position. Markdown checklists apply per-host rules instead.
 */
export interface IEvidenceMarkdownClaim extends IEvidenceClaimBase<
  "markdown",
  EvidenceMarkdownSymbol
> {}
