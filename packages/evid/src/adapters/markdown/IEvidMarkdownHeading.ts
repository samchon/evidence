/**
 * One ATX heading and its public anchor candidate.
 *
 * The scanner keeps normalized heading data separate from source positions so
 * hierarchy and duplicate-anchor handling can decide public unit ownership.
 */
export interface IEvidMarkdownHeading {
  /**
   * Stores the ATX depth used to establish structural containment.
   *
   * Only supported depths can create nested public Markdown units.
   */
  level: number;

  /**
   * Stores visible heading text after marker normalization.
   *
   * The adapter exposes this text as the human-readable unit name.
   */
  title: string;

  /**
   * Stores the candidate anchor before duplicate disambiguation.
   *
   * Later materialization uses it to form a stable public address.
   */
  anchor: string;
}
