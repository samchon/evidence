import type { IEvidPrismaModel } from "./IEvidPrismaModel";

/** Parsed schema units beside the whole-set cache identity.
 *
 * Prisma resolves relations across schema files, so the cache and parser result
 * belong to the selected file set rather than an individual source file.
 */
export interface IEvidPrismaLoadResult {
  /**
   * Semantic models materialized from the entire selected schema set.
   *
   * Prisma resolves relations across files, so this collection belongs to the
   * complete parser input rather than to one selected physical source file.
   */
  models: IEvidPrismaModel[];

  /**
   * Digest identifying the parser version and complete selected source set.
   *
   * The loader returns this cache identity with its models so callers can retain
   * a result only while every selected schema source and parser version agree.
   */
  digest: string;
}
