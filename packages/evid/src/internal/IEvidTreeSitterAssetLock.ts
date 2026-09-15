import type { tags } from "typia";

/**
 * Serialized ownership record for one cross-process grammar cache transfer.
 *
 * The token prevents an old owner from deleting a lock reacquired after a
 * crash; the PID permits stale-lock recovery when that owner is no longer
 * alive.
 */
export interface IEvidTreeSitterAssetLock {
  /**
   * Positive operating-system process ID that acquired the transfer lock.
   *
   * Stale-lock recovery checks whether this owner remains alive before allowing
   * another process to replace the serialized cache record.
   */
  pid: number & tags.Type<"uint32"> & tags.Minimum<1>;

  /**
   * Random acquisition token checked before releasing a lock with the same
   * path.
   *
   * It prevents a former owner from deleting a lock that another process
   * acquired after crash recovery reused the path.
   */
  token: string;
}
