import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IZigDocumentationAttachment } from "./IZigDocumentationAttachment";

/**
 * Represents a Zig documentation carrier or tag-bearing unsupported carrier.
 *
 * The record retains source-mapped `///` text and ineligible annotation carriers
 * until alias reconciliation determines the supported documentation host.
 */
export interface IZigDocumentation {
  /**
   * Identifies this physical documentation carrier within its source analysis.
   *
   * Attachments use this key before the adapter materializes semantic units.
   */
  id: string;

  /**
   * Locates the half-open UTF-16 span occupied by the documentation carrier.
   *
   * Review fingerprints exclude this range from its attached declaration content.
   */
  range: IEvidenceSourceRange;

  /**
   * Describes delimiters and annotation rules for parsing this carrier.
   *
   * Documentation mapping preserves these rules while masking ineligible examples.
   */
  syntax: IEvidenceCommentSyntax;

  /**
   * Lists physical declaration sites directly attached to this carrier.
   *
   * Unsupported tagged carriers remain unattached for diagnostic host creation.
   */
  attachments: IZigDocumentationAttachment[];
}
