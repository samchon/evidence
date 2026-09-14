import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IDartDocumentationAttachment } from "./IDartDocumentationAttachment";

/**
 * Represents a Dart documentation carrier or tag-bearing unsupported carrier.
 *
 * The scanner preserves unsupported tagged text as well as attached DartDoc so
 * the adapter can report a misplaced annotation instead of silently ignoring it.
 */
export interface IDartDocumentation {
  /** Stable identity of this extraction record. */
  id: string;

  /** Half-open original UTF-16 source span. */
  range: IEvidenceSourceRange;

  /** Comment delimiters and annotation rules for this carrier. */
  syntax: IEvidenceCommentSyntax;

  /** Declaration sites to which this documentation attaches. */
  attachments: IDartDocumentationAttachment[];
}
