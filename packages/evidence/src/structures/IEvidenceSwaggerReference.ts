import type { IEvidenceReferenceBase } from "./IEvidenceReferenceBase";

/**
 * Swagger/OpenAPI operations used as evidence. Each operation is a separate
 * unit addressed by a whitespace-free `METHOD:/path` token.
 */
export interface IEvidenceSwaggerReference extends IEvidenceReferenceBase<
  "swagger",
  "operation"
> {
  /**
   * Exact local JSON/YAML path or HTTP(S) URL, not a glob or directory.
   *
   * - Relative paths resolve from root. Absolute paths are accepted; Windows
   *   drive-relative paths are invalid.
   * - Remote loading and document normalization failures are reported.
   * - Use separate reference entries for independent coverage of multiple documents.
   */
  file: string;
}
