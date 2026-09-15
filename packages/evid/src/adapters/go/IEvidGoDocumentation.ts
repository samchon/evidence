import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { IEvidGoDocumentationAttachment } from "./IEvidGoDocumentationAttachment";

/**
 * Retains a Go documentation carrier and its scanner-established attachments.
 *
 * EvidGoAdapterBase reads these records after parsing closes to create documentation
 * hosts and report unsupported annotations without reinterpreting the source.
 */
export interface IEvidGoDocumentation {
  /**
   * Stable comment-run identifier referenced by scanner attachments.
   *
   * It identifies source text rather than a semantic package member.
   */
  id: string;

  /**
   * Exact source range decoded as documentation and excluded from fingerprints.
   *
   * The range also anchors diagnostics for unsupported annotations.
   */
  range: IEvidSourceRange;

  /**
   * Line-comment syntax used to recover normalized documentation text.
   *
   * Evid parsing relies on this captured syntax after parsing closes.
   */
  syntax: IEvidCommentSyntax;

  /**
   * Declaration sites accepted as the comment run's direct owners.
   *
   * Package reconciliation does not attach it to same-named declarations elsewhere.
   */
  attachments: IEvidGoDocumentationAttachment[];
}
