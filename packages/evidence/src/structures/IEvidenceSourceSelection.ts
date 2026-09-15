/**
 * Filesystem selection shared by claim and reference discovery.
 *
 * The source loader resolves the root from the configuration directory and
 * applies ordered patterns within that logical root. Artifact-specific symbol
 * selection happens later, after these files have been read and extracted.
 */
export interface IEvidenceSourceSelection {
  /**
   * Population directory resolved from the configuration file's directory.
   *
   * Omission uses the configuration directory itself, independently of the
   * process working directory at extraction time.
   */
  root?: string;

  /**
   * Ordered root-relative inclusion and exclusion patterns.
   *
   * These follow the shared claim files contract; their order controls which
   * logical addresses remain selected before artifact extraction.
   */
  files: string[];
}
