/**
 * Filesystem location needed to observe source changes or recovery.
 *
 * A dependency can name a read file, a directory whose topology affects globs,
 * or a currently missing path. Watch retains these records after failures so a
 * newly created or repaired input can trigger evaluation without editing a file
 * that was already present in the successful snapshot.
 */
export interface IEvidSourceDependency {
  /**
   * Absolute logical or physical path that can invalidate the result.
   *
   * The path need not exist. Dropping missing dependencies would prevent watch
   * from observing their later creation or restoration.
   */
  path: string;

  /**
   * Whether observation includes descendants of the recorded path.
   *
   * False denotes an exact dependency. Recursive directory observation detects
   * topology changes that can add selected files beyond the known source list.
   */
  recursive: boolean;
}
