import type { IEvidenceReferenceBase } from "./IEvidenceReferenceBase";

/**
 * Swagger/OpenAPI operations used as evidence. Each operation is a separate
 * unit addressed as `METHOD:/path`. Swagger is reference-only.
 */
export interface IEvidenceSwaggerReference extends IEvidenceReferenceBase<"swagger"> {
  /**
   * Exact local JSON/YAML path or HTTP(S) URL, not a glob or directory.
   *
   * - Relative paths resolve from root. Absolute paths are accepted; Windows
   *   drive-relative paths are invalid.
   * - Remote loading and document normalization failures are reported.
   * - Each normalized operation is addressed as METHOD:/path, without whitespace.
   * - Use separate reference entries for independent coverage of multiple documents.
   */
  file: string;
}
