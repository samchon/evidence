/**
 * A recognized documentation annotation before semantic attachment.
 *
 * Parser offsets remain relative to normalized documentation so the mapper can
 * recover the original source range after multiline bodies are assembled.
 */
export interface IEvidencePendingEvidenceTag {
  /**
   * Annotation spelling, including link and review variants with distinct later
   * rules.
   *
   * Attachment dispatch uses this value to choose target parsing and graph
   * handling without re-reading the normalized documentation text.
   */
  kind:
    | "evidence"
    | "link"
    | "evidenceExclude"
    | "evidenceReview"
    | "EvidenceExcludeReview";
  /**
   * Continued body text without the tag marker.
   *
   * The mapper joins continuation lines before target parsing while retaining
   * offsets into the normalized documentation carrier.
   */
  body: string;

  /**
   * Inclusive UTF-16 offset of the annotation in normalized documentation.
   *
   * Source mapping combines this boundary with the carrier's normalized text to
   * recover the authored location for diagnostics.
   */
  start: number;

  /**
   * Exclusive UTF-16 offset immediately after the tag's continued body.
   *
   * Together with {@link start}, this forms the half-open annotation range used
   * when translating normalized offsets back to source positions.
   */
  end: number;
}
