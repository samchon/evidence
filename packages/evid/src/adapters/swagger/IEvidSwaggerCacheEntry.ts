import type { IEvidSwaggerLoadResult } from "./IEvidSwaggerLoadResult";

/** Remembered normalization outcome for one exact document digest.
 *
 * The cache records failures as well as results so a malformed unchanged source
 * has deterministic behavior without repeating conversion work.
 */
export interface IEvidSwaggerCacheEntry {
  /** Successful operation inventory, when normalization completed.
   *
   * Omission means this entry represents the failure below.
   */
  result?: IEvidSwaggerLoadResult;

  /** Stable failure message for the cached input.
   *
   * Omission means the result is safe to clone for a caller.
   */
  problem?: string;
}
