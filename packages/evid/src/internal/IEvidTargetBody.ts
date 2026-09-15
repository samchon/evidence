/**
 * The target token and remaining authored explanation from one annotation body.
 *
 * Splitting happens before artifact-specific parsing so whitespace in prose
 * cannot alter a target's grammar or its diagnostic location.
 */
export interface IEvidTargetBody {
  /**
   * Non-whitespace target token as authored, before target resolution.
   *
   * Artifact-specific target parsing consumes this spelling while its original
   * boundary remains available for precise diagnostics.
   */
  target: string;

  /**
   * Trimmed explanatory prose after the target.
   *
   * It may be empty and never participates in target grammar, selection, or
   * resolution.
   */
  remainder: string;
}
