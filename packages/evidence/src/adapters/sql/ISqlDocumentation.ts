import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { ISqlDocumentationAttachment } from "./ISqlDocumentationAttachment";

/** Represents one SQL comment carrier considered for documentation attachment.
 *
 * The scanner keeps every relevant carrier, including one that cannot attach,
 * so the documentation parser can diagnose annotations without silently
 * dropping their source range.
 */
export interface ISqlDocumentation {
  /** Identifies this documentation record within the source snapshot.
   *
   * Attachment records refer to declarations rather than this value, which
   * keeps comment ownership directional.
   */
  id: string;

  /** Locates the complete carrier in original half-open UTF-16 coordinates.
   *
   * Adjacent line comments can share one range when the scanner forms a run.
   */
  range: IEvidenceSourceRange;

  /** Describes delimiters and tag rules when the carrier has usable syntax.
   *
   * Omission leaves the carrier available for unsupported-annotation handling
   * without pretending that it has a parseable documentation form.
   */
  syntax?: IEvidenceCommentSyntax;

  /** Maps dialect-provided documentation text back to original coordinates.
   *
   * Omission means this carrier is represented only by its raw source range.
   */
  mapped?: IEvidenceDocumentation;

  /** Lists every physical declaration site documented by this carrier.
   *
   * An empty list preserves detached or trailing annotation carriers for later
   * diagnostics.
   */
  attachments: ISqlDocumentationAttachment[];
}
