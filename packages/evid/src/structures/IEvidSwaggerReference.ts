import type { IEvidReferenceBase } from "./IEvidReferenceBase";

/**
 * Swagger/OpenAPI operations required by one reference obligation.
 *
 * Each operation is a separate unit addressed by a whitespace-free
 * `METHOD:/path` token. The document boundary belongs to the reference entry,
 * allowing identical operation tokens in different documents to impose
 * independent coverage requirements.
 *
 * @example
 *   GET:/users/{id}
 */
export interface IEvidSwaggerReference extends IEvidReferenceBase<
  "swagger",
  "operation"
> {
  /**
   * Exact local JSON/YAML path or HTTP(S) URL, not a glob or directory.
   *
   * - Relative paths resolve from root. Absolute paths are accepted; Windows
   *   drive-relative paths are invalid.
   * - Remote loading and document normalization failures are reported.
   * - Use separate reference entries for independent coverage of multiple
   *   documents.
   */
  file: string;
}
