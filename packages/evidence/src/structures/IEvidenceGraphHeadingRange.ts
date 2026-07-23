import type { EvidenceGraphHeadingLevel } from "./EvidenceGraphHeadingLevel";

/**
 * A contiguous range of Markdown heading depths that defines documentary
 * evidence units.
 *
 * Heading hierarchy distinguishes a document's broad topic from its separately
 * reviewable claims. Selecting a range keeps coverage attached to the intended
 * level of detail instead of making a document title answer for every nested
 * paragraph.
 */
export interface IEvidenceGraphHeadingRange {
  /** Smallest included ATX heading level. */
  minimum: EvidenceGraphHeadingLevel;

  /** Largest included ATX heading level. */
  maximum: EvidenceGraphHeadingLevel;
}
