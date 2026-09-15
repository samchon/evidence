import type { IEvidSwaggerOperation } from "./IEvidSwaggerOperation";

/** Normalized operations from one Swagger or OpenAPI document.
 *
 * The loader converts accepted source versions to this version-neutral shape
 * before the adapter materializes public operation units.
 */
export interface IEvidSwaggerLoadResult {
  /** Operations ordered by their public targets.
   *
   * Each target occurs at most once; duplicates are rejected during loading.
   */
  operations: IEvidSwaggerOperation[];
}
