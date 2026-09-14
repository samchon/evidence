import type { tags } from "typia";

/** Identifies a cache lock owner so crashed processes do not block future checks. */
export interface ITreeSitterAssetLock {
  /** Process that owns the transfer lock. */
  pid: number & tags.Type<"uint32"> & tags.Minimum<1>;

  /** Unique acquisition token checked before releasing a lock. */
  token: string;
}
