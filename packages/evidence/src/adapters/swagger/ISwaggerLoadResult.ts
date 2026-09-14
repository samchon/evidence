import type { ISwaggerOperation } from "./ISwaggerOperation";

/** Normalized operations from one Swagger or OpenAPI document. */
export interface ISwaggerLoadResult {
  operations: ISwaggerOperation[];
}
