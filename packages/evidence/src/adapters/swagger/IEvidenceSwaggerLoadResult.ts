import type { IEvidenceSwaggerOperation } from "./IEvidenceSwaggerOperation";

/**
 * Normalized operations from one Swagger or OpenAPI document.
 *
 * The loader converts accepted source versions to this version-neutral shape
 * before the adapter materializes public operation units.
 */
export interface IEvidenceSwaggerLoadResult {
  /**
   * Operations ordered by their public targets.
   *
   * Each target occurs at most once; duplicates are rejected during loading.
   */
  operations: IEvidenceSwaggerOperation[];
}
