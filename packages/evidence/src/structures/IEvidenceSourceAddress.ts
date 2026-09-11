/** One selected logical address of a physical file. */
export interface IEvidenceSourceAddress {
  /** Absolute path retaining the selected symlink or hard-link spelling. */
  absolute: string;

  /** Case-sensitive, slash-separated path relative to the population root. */
  relative: string;

  /** Path relative to the configuration directory, or absolute across volumes. */
  display: string;

  /**
   * False when the adapter loaded this address only to analyze a selected dependency.
   *
   * @default true
   */
  selected?: boolean;
}
