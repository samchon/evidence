/** Adapter-provided documentation text with exact mapping back to its original source. */
export interface IEvidenceDocumentation {
  hostId: string;
  text: string;
  /** Original UTF-16 start of each character, followed by the final source boundary. */
  offsets: number[];
  /** Original exclusive end of each character, preserving gaps and decoded escapes. */
  ends: number[];
  /** Other tools' line-start tags end an acknowledgement reason in JSDoc-like hosts. */
  tagBoundaries: boolean;
  /** True only for documented declaration positions where withdrawal is meaningful. */
  allowWithdrawal: boolean;
}
