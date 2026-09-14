import type { tags } from "typia";

/**
 * Serialized ownership record for one cross-process grammar cache transfer.
 *
 * The token prevents an old owner from deleting a lock reacquired after a crash;
 * the PID permits stale-lock recovery when that owner is no longer alive.
 */
export interface ITreeSitterAssetLock {
  /** Positive operating-system process ID that acquired the transfer lock. */
  pid: number & tags.Type<"uint32"> & tags.Minimum<1>;

  /** Random acquisition token checked before releasing a lock with the same path. */
  token: string;
}
