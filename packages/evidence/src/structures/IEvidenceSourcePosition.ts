/** Position in the original JavaScript source string, without newline normalization. */
export interface IEvidenceSourcePosition {
  /** Zero-based UTF-16 code-unit offset, suitable for String.slice. */
  offset: number;
  /** One-based line number; LF advances the line, including the LF in CRLF. */
  line: number;
  /** One-based UTF-16 column; CR and each surrogate code unit occupy one column. */
  column: number;
}
