import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IEvidenceGoDocumentationAttachment } from "./IEvidenceGoDocumentationAttachment";

/**
 * Retains a Go documentation carrier and its scanner-established attachments.
 *
 * EvidenceGoAdapter reads these records after parsing closes to create
 * documentation hosts and report unsupported annotations without reinterpreting
 * the source.
 */
export interface IEvidenceGoDocumentation {
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
  range: IEvidenceSourceRange;

  /**
   * Line-comment syntax used to recover normalized documentation text.
   *
   * evidence parsing relies on this captured syntax after parsing closes.
   */
  syntax: IEvidenceCommentSyntax;

  /**
   * Declaration sites accepted as the comment run's direct owners.
   *
   * Package reconciliation does not attach it to same-named declarations
   * elsewhere.
   */
  attachments: IEvidenceGoDocumentationAttachment[];
}
