/**
 * A recognized documentation annotation before semantic attachment.
 *
 * Parser offsets remain relative to normalized documentation so the mapper can
 * recover the original source range after multiline bodies are assembled.
 */
export interface IPendingEvidenceTag {
  /** Annotation spelling, including link and review variants that have different later rules. */
  kind:
    | "evidence"
    | "link"
    | "evidenceExclude"
    | "evidenceReview"
    | "evidenceExcludeReview";
  /** Continued body text without the tag marker. */
  body: string;

  /** Inclusive UTF-16 offset of the annotation in normalized documentation. */
  start: number;

  /** Exclusive UTF-16 offset immediately after its continued body. */
  end: number;
}
