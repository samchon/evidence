/** Couples trimmed text with the coordinates of its retained characters.
 *
 * Prisma comment normalization uses this temporary value to remove surrounding
 * whitespace without severing the documentation text from its source offsets.
 */
export interface IEvidTrimmedMapping {
  /** Contains the retained text after leading and trailing whitespace removal.
   *
   * An empty value has empty coordinate arrays.
   */
  text: string;

  /** Maps each retained character to its original UTF-16 start offset.
   *
   * Entries align one-for-one with `text`.
   */
  offsets: number[];

  /** Maps each retained character to its original UTF-16 end offset.
   *
   * Entries align with `offsets` and preserve the source span of every
   * character.
   */
  ends: number[];
}
