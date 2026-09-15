import type { IEvidSourcePosition } from "./IEvidSourcePosition";

/**
 * A half-open span in the original captured source string.
 *
 * The inclusive start and exclusive end match JavaScript slicing. Both
 * positions retain diagnostic coordinates in the same unnormalized UTF-16 text,
 * so adapters can expose serializable locations without retaining their parser
 * nodes.
 *
 * @example
 *   const fragment: string = content.slice(
 *     range.start.offset,
 *     range.end.offset,
 *   );
 *   // Equal offsets describe an empty span, such as an inserted missing token.
 */
export interface IEvidSourceRange {
  /**
   * Inclusive first position belonging to the span.
   *
   * Use its offset as the first argument to `String.slice`; line and column
   * provide the corresponding original-source diagnostic location.
   */
  start: IEvidSourcePosition;

  /**
   * Exclusive position immediately after the span.
   *
   * Use its offset directly as the slicing end. Adding one would include an
   * unrelated character and mishandle zero-width ranges.
   */
  end: IEvidSourcePosition;
}
