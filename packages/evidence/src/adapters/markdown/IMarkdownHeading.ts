/** One ATX heading and its public anchor candidate.
 *
 * The scanner keeps normalized heading data separate from source positions so
 * hierarchy and duplicate-anchor handling can decide public unit ownership.
 */
export interface IMarkdownHeading {
  /** ATX depth used to establish structural containment. */
  level: number;

  /** Visible heading text after marker normalization. */
  title: string;

  /** Candidate anchor before duplicate disambiguation. */
  anchor: string;
}
