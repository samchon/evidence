/**
 * A materialized fixture project and the handle that disposes it.
 *
 * The directory is a real temporary project with its own `node_modules`, so a
 * case that forgets to clean up leaves a linked copy of the workspace behind.
 * Every case therefore disposes it in a `finally`.
 */
export interface IEvidenceProject {
  /** Absolute path of the throwaway project root. */
  readonly directory: string;

  /**
   * Removes the fixture, tolerating a directory the OS has not released yet.
   *
   * Safe to call more than once, and safe to call after a failed run.
   */
  cleanup(): void;
}
