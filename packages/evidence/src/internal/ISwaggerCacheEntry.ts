import type { ISwaggerLoadResult } from "./ISwaggerLoadResult";

/** Remembered normalization outcome for one exact document digest. */
export interface ISwaggerCacheEntry {
  result?: ISwaggerLoadResult;
  problem?: string;
}
