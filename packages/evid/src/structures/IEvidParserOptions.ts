import type { tags } from "typia";

/**
 * Admission limits for a parser runtime's native resources.
 *
 * A slot remains occupied throughout grammar acquisition, parsing, and the
 * asynchronous extraction callback. Bounding callbacks therefore also bounds
 * live parser/tree ownership, rather than only the synchronous parse
 * operation.
 */
export interface IEvidParserOptions {
  /**
   * Maximum number of admitted parse sessions at once.
   *
   * Additional requests wait in FIFO order. Omission permits four sessions;
   * zero and non-integer values are rejected during runtime construction.
   *
   * @default 4
   */
  concurrency?: number & tags.Type<"uint32"> & tags.Minimum<1>;
}
