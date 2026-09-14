import type { IPrismaModel } from "./IPrismaModel";

/** Parsed schema units beside the whole-set cache identity.
 *
 * Prisma resolves relations across schema files, so the cache and parser result
 * belong to the selected file set rather than an individual source file.
 */
export interface IPrismaLoadResult {
  /** Semantic models materialized from the entire selected schema set. */
  models: IPrismaModel[];

  /** Digest identifying the parser version and complete selected source set. */
  digest: string;
}
