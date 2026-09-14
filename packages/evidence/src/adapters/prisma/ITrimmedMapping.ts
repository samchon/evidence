/** Trimmed text and its retained source-coordinate map. */
export interface ITrimmedMapping {
  text: string;
  offsets: number[];
  ends: number[];
}
