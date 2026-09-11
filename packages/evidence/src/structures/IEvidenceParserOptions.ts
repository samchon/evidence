import type { tags } from "typia";

/** Limits the number of live parser/tree sessions owned by one runtime. */
export interface IEvidenceParserOptions {
  /** Positive integer; defaults to four. */
  concurrency?: number & tags.Type<"uint32"> & tags.Minimum<1>;
}
