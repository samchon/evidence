/**
 * Adapter-normalized documentation with a map back to its source spelling.
 *
 * Removing comment prefixes or decoding string escapes changes text coordinates.
 * The tag parser uses the parallel offset arrays to recover precise source spans
 * for diagnostics and fingerprint exclusions. Host policy determines which tags
 * terminate reasons and whether a withdrawal directive has declaration ownership.
 */
export interface IEvidenceDocumentation {
  /**
   * Identity of the documentation carrier represented by this text.
   *
   * Parsed statements retain this ID so adapters can attach them to semantic units.
   */
  hostId: string;

  /**
   * Normalized text to scan for annotations.
   *
   * Its UTF-16 indices address the mapping arrays rather than the original file
   * directly, since delimiters and encoded characters may have been transformed.
   */
  text: string;

  /**
   * Original UTF-16 start for each text code unit and the final source boundary.
   *
   * The terminal entry permits mapping a position at the end of normalized text;
   * removed prefixes can leave gaps between consecutive original offsets.
   */
  offsets: number[];

  /**
   * Original exclusive end corresponding to each normalized text code unit.
   *
   * Separate ends preserve escaped spellings and removed gaps that cannot be
   * represented by adding one to the mapped start.
   */
  ends: number[];

  /**
   * Whether other tools' line-start tags terminate an acknowledgement reason.
   *
   * JSDoc-like hosts enable this boundary so unrelated tags are not absorbed into
   * the preceding Evidence annotation's reason text.
   */
  tagBoundaries: boolean;

  /**
   * Whether the host owns a declaration that a withdrawal directive can exclude.
   *
   * Adapters enable this only at supported declaration documentation positions;
   * arbitrary prose cannot hide unrelated semantic units.
   */
  allowWithdrawal: boolean;
}
