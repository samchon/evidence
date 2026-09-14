/**
 * The target token and remaining authored explanation from one annotation body.
 *
 * Splitting happens before artifact-specific parsing so whitespace in prose
 * cannot alter a target's grammar or its diagnostic location.
 */
export interface IEvidenceTargetBody {
  /** Non-whitespace target token as authored, before target resolution. */
  target: string;

  /** Trimmed explanatory prose after the target; it may be empty. */
  remainder: string;
}
