import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IEvidenceJavaDocumentationAttachment } from "./IEvidenceJavaDocumentationAttachment";

/**
 * Retains a Javadoc carrier and its scanner-established declaration
 * attachments.
 *
 * EvidenceJavaAdapter consumes these physical records after scanning to create
 * evidence hosts and diagnose unsupported annotations without reparsing
 * comments.
 */
export interface IEvidenceJavaDocumentation {
  /**
   * Stable physical-comment ID used by attachments and tag parsing.
   *
   * It does not identify a semantic Java declaration.
   */
  id: string;

  /**
   * Exact comment range retained for diagnostics and fingerprint exclusion.
   *
   * Only this span is decoded as a Javadoc annotation carrier.
   */
  range: IEvidenceSourceRange;

  /**
   * Delimiter details needed to read the Javadoc text accurately.
   *
   * Evidence parsing consumes this syntax instead of inferring comments again.
   */
  syntax: IEvidenceCommentSyntax;

  /**
   * Declaration sites established by source adjacency during scanning.
   *
   * Later family reconciliation never widens this attachment relationship.
   */
  attachments: IEvidenceJavaDocumentationAttachment[];
}
