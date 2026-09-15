import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IEvidenceCDocumentationAttachment } from "./IEvidenceCDocumentationAttachment";

/**
 * Stores a C comment or literal that may carry evidence tags.
 *
 * The scanner retains carriers even when no supported declaration accepts them.
 * That distinction lets the adapter publish a diagnostic host for misplaced
 * annotations instead of silently discarding an annotation requested by
 * source.
 */
export interface IEvidenceCDocumentation {
  /**
   * Stable source-range key used to deduplicate one documentation carrier.
   *
   * It identifies the physical carrier rather than a declaration or semantic
   * unit.
   */
  id: string;

  /**
   * Exact carrier range, later excluded from the source fingerprint as needed.
   *
   * The adapter also uses it as the host location for parsed or unsupported
   * annotations.
   */
  range: IEvidenceSourceRange;

  /**
   * Delimiters and tag-boundary rules required to parse the carrier's text.
   *
   * Documentation reading uses this syntax rather than guessing from raw
   * source.
   */
  syntax: IEvidenceCommentSyntax;

  /**
   * Supported declaration sites to which this carrier attaches.
   *
   * Unattached tag-bearing carriers remain available for unsupported-host
   * diagnostics.
   */
  attachments: IEvidenceCDocumentationAttachment[];
}
