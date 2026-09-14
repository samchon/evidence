import type { ISwaggerOperationLocation } from "./ISwaggerOperationLocation";

/** One normalized Swagger operation and its semantic fingerprint input.
 *
 * This separates the public operation address from content used to detect a
 * schema change, while retaining optional source coordinates for diagnostics.
 */
export interface ISwaggerOperation {
  /** Uppercase HTTP method forming the target prefix. */
  method: string;

  /** Absolute OpenAPI path forming the target suffix. */
  path: string;

  /** Stable public address in `METHOD:/path` form. */
  target: string;

  /** Digest of canonical operation semantics.
   *
   * Description metadata and reference indirection are normalized before this
   * value is computed, keeping review state tied to API meaning.
   */
  digest: string;

  /** Original description text, when the operation supplies one.
   *
   * Omission distinguishes no description from an explicitly empty string.
   */
  description?: string;

  /** Source coordinates for the operation and mapped description, when known.
   *
   * Converted or aliased YAML may not have a direct scalar location.
   */
  location?: ISwaggerOperationLocation;
}
