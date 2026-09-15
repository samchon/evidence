/**
 * Configured, logical, and physical locations of a source population's root.
 *
 * Relative roots resolve from the configuration directory, while directory
 * symlinks and Windows junctions can redirect the physical scan. These
 * spellings remain separate so discovery can enforce boundaries and diagnostics
 * can still explain the path the user configured, including roots that cannot
 * be read.
 */
export interface IEvidSourceRoot {
  /**
   * Root spelling authored in configuration, defaulting to a dot.
   *
   * Preserve this value for explanations rather than replacing it with the
   * resolved absolute or physical path.
   */
  declared: string;

  /**
   * Absolute logical directory before following filesystem links.
   *
   * Relative configuration roots are anchored here. This may differ from the
   * physical scan directory when a symlink or junction redirects the root.
   */
  absolute: string;

  /**
   * Canonical directory used for scanning when discovery resolves the root.
   *
   * Omission records that no directory could be resolved. The logical path
   * remains available for diagnostics and watch recovery of a missing or
   * repaired root.
   */
  physical?: string;

  /**
   * User-facing root path relative to the configuration directory where
   * possible.
   *
   * Cross-volume paths remain absolute. This presentation choice does not
   * replace logical or physical identity during source discovery.
   */
  display: string;
}
