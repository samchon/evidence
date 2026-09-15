import type { IEvidSwaggerOperationLocation } from "./IEvidSwaggerOperationLocation";

/** One normalized Swagger operation and its semantic fingerprint input.
 *
 * This separates the public operation address from content used to detect a
 * schema change, while retaining optional source coordinates for diagnostics.
 */
export interface IEvidSwaggerOperation {
  /**
   * Stores the uppercase HTTP method forming the public target prefix.
   *
   * Normalization keeps OpenAPI method spelling independent from target matching.
   */
  method: string;

  /**
   * Stores the absolute OpenAPI path forming the public target suffix.
   *
   * Its literal path spelling remains distinct from the HTTP method identity.
   */
  path: string;

  /**
   * Provides the stable public address in `METHOD:/path` form.
   *
   * Evid tags resolve operations through this combined method-and-path identity.
   */
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
  location?: IEvidSwaggerOperationLocation;
}
