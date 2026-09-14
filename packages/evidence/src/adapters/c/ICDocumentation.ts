import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { ICDocumentationAttachment } from "./ICDocumentationAttachment";

/**
 * Stores a C comment or literal that may carry Evidence tags.
 *
 * The scanner retains carriers even when no supported declaration accepts them.
 * That distinction lets the adapter publish a diagnostic host for misplaced
 * annotations instead of silently discarding an annotation requested by source.
 */
export interface ICDocumentation {
  /** Stable source-range key used to deduplicate one documentation carrier. */
  id: string;

  /** Exact carrier range, later excluded from the source fingerprint as needed. */
  range: IEvidenceSourceRange;

  /** Delimiters and tag-boundary rules required to parse the carrier's text. */
  syntax: IEvidenceCommentSyntax;

  /** Supported declaration sites to which this carrier attaches. */
  attachments: ICDocumentationAttachment[];
}
