import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IKotlinDocumentationAttachment } from "./IKotlinDocumentationAttachment";

/**
 * Represents a Kotlin documentation carrier or tag-bearing unsupported carrier.
 *
 * KDoc attachment is established from source adjacency, while tagged text in an
 * ineligible carrier remains present for a host-level diagnostic.
 */
export interface IKotlinDocumentation {
  /** Identifies this physical KDoc or unsupported carrier within the scanned source.
   *
   * Attachments and host generation use this scanner-local value, which is distinct from a declaration's semantic identity.
   */
  id: string;

  /** Locates the carrier's original half-open UTF-16 source span.
   *
   * The adapter preserves this range for diagnostics and annotation-range exclusion.
   */
  range: IEvidenceSourceRange;

  /** Defines the carrier delimiters and annotation-reading rules.
   *
   * KDoc parsing uses this syntax rather than guessing from raw source text.
   */
  syntax: IEvidenceCommentSyntax;

  /** Lists declaration sites that accept this carrier as KDoc.
   *
   * The scanner establishes these source-adjacent attachments before receiver and unit resolution.
   */
  attachments: IKotlinDocumentationAttachment[];
}
