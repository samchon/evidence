import type { IEvidenceSourceDependency } from "../structures/IEvidenceSourceDependency";

/**
 * Dependencies found while scanning a configuration module graph.
 *
 * A failure does not erase prior discoveries: watch mode needs these paths to
 * observe the repair that makes evaluation possible again.
 */
export interface IConfigDependencyScan {
  /** File and directory dependencies that must invalidate configuration evaluation. */
  dependencies: IEvidenceSourceDependency[];

  /** Read, parse, or resolution failure after any recoverable dependencies were recorded. */
  cause?: unknown;
}
