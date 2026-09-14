import type { ISwaggerOperationLocation } from "./ISwaggerOperationLocation";

/** One normalized Swagger operation and its semantic fingerprint input. */
export interface ISwaggerOperation {
  method: string;
  path: string;
  target: string;
  digest: string;
  description?: string;
  location?: ISwaggerOperationLocation;
}
