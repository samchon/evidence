import type { IEvidSourceDependency } from "../structures/IEvidSourceDependency";

/**
 * Dependencies found while scanning a configuration module graph.
 *
 * A failure does not erase prior discoveries: watch mode needs these paths to
 * observe the repair that makes evaluation possible again.
 */
export interface IEvidConfigDependencyScan {
  /**
   * File and directory dependencies that must invalidate configuration evaluation.
   *
   * `EvidConfigDependencyScanner` records resolved module files, package boundaries,
   * and missing resolution candidates here so watch mode can rerun evaluation
   * after either a content edit or a filesystem-topology repair.
   */
  dependencies: IEvidSourceDependency[];

  /**
   * Read, parse, or resolution failure after recoverable dependencies were recorded.
   *
   * Omission means scanning completed. When present, callers retain
   * `dependencies` instead of replacing them with an empty watch set that
   * could miss the change which repairs the configuration graph.
   */
  cause?: unknown;
}
