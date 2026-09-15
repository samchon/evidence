import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IEvidenceMatlabDocumentationAttachment } from "./IEvidenceMatlabDocumentationAttachment";

/**
 * Represents a MATLAB documentation carrier or tag-bearing unsupported carrier.
 *
 * MATLAB help placement has language-specific attachment rules, so this record
 * preserves both accepted help and tagged text that needs an actionable
 * failure.
 */
export interface IEvidenceMatlabDocumentation {
  /**
   * Identifies this physical documentation carrier within one source analysis.
   *
   * Attachments use the key before ownership maps declarations to public units.
   */
  id: string;

  /**
   * Locates the half-open UTF-16 source span occupied by the help text.
   *
   * Inventory fingerprints exclude this range when reviewing documented
   * declarations.
   */
  range: IEvidenceSourceRange;

  /**
   * Describes comment delimiters and annotation rules used to parse this
   * carrier.
   *
   * EvidenceMatlabDocumentation relies on the syntax to preserve source offsets
   * while masking examples.
   */
  syntax: IEvidenceCommentSyntax;

  /**
   * Lists physical declaration sites that directly own this help text.
   *
   * Unsupported tagged carriers remain unattached so the adapter can report
   * their placement.
   */
  attachments: IEvidenceMatlabDocumentationAttachment[];
}
