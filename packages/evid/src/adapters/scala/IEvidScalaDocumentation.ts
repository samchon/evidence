import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { IEvidScalaDocumentationAttachment } from "./IEvidScalaDocumentationAttachment";

/**
 * Represents a Scala documentation carrier or tag-bearing unsupported carrier.
 *
 * Scaladoc remains tied to its physical declaration site while later export
 * resolution may add addresses for the same semantic declaration.
 */
export interface IEvidScalaDocumentation {
  /**
   * Identifies this physical documentation carrier within its source analysis.
   *
   * Attachments use this key before the adapter materializes semantic units.
   */
  id: string;

  /**
   * Locates the half-open UTF-16 span occupied by the documentation carrier.
   *
   * Review fingerprints exclude this range from its attached declaration
   * content.
   */
  range: IEvidSourceRange;

  /**
   * Describes delimiters and annotation rules for parsing this carrier.
   *
   * Documentation mapping preserves these rules while masking ineligible
   * examples.
   */
  syntax: IEvidCommentSyntax;

  /**
   * Lists physical declaration sites directly attached to this carrier.
   *
   * Unsupported tagged carriers remain unattached for diagnostic host creation.
   */
  attachments: IEvidScalaDocumentationAttachment[];
}
