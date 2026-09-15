import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { IEvidJavaDocumentationAttachment } from "./IEvidJavaDocumentationAttachment";

/**
 * Retains a Javadoc carrier and its scanner-established declaration attachments.
 *
 * EvidJavaAdapterBase consumes these physical records after scanning to create evidence
 * hosts and diagnose unsupported annotations without reparsing comments.
 */
export interface IEvidJavaDocumentation {
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
  range: IEvidSourceRange;

  /**
   * Delimiter details needed to read the Javadoc text accurately.
   *
   * Evid parsing consumes this syntax instead of inferring comments again.
   */
  syntax: IEvidCommentSyntax;

  /**
   * Declaration sites established by source adjacency during scanning.
   *
   * Later family reconciliation never widens this attachment relationship.
   */
  attachments: IEvidJavaDocumentationAttachment[];
}
