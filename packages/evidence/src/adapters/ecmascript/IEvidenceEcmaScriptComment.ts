import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IEvidenceEcmaScriptCommentAttachment } from "./IEvidenceEcmaScriptCommentAttachment";

/**
 * Retains one parsed source comment and its scanner-established JSDoc
 * attachments.
 *
 * The adapter later materializes only attachments whose units become public, so
 * a comment resembling JSDoc cannot create evidence without an eligible
 * declaration.
 */
export interface IEvidenceEcmaScriptComment {
  /**
   * Stable identifier for this parsed comment within its source snapshot.
   *
   * Attachment processing uses the identifier to distinguish this comment from
   * other comments that may have the same text or nearby physical location.
   */
  id: string;

  /**
   * Physical source range occupied by the complete comment.
   *
   * Materialized documentation uses this range when the comment supplies a
   * claim, while the declaration host retains its own range when no comment
   * does.
   */
  range: IEvidenceSourceRange;

  /**
   * Parsed comment syntax used to interpret its Evidence annotations.
   *
   * The annotation parser receives this classification so it can apply the
   * language-appropriate JSDoc and line-comment rules.
   */
  syntax: IEvidenceCommentSyntax;

  /**
   * Declaration carriers that the scanner determined this comment may document.
   *
   * Each entry preserves the semantic unit and physical site separately because
   * one declaration position may affect more than one unit.
   */
  attachments: IEvidenceEcmaScriptCommentAttachment[];
}
