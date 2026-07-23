/**
 * A population of Swagger or OpenAPI operations that the owning claim must
 * cite.
 *
 * Swagger references are evidence-only: an API operation can ground a
 * TypeScript or Markdown claim, but a Swagger document cannot host `@evidence`
 * declarations. Every operation under the normalized document's `paths` object
 * becomes one independent evidence unit.
 */
export interface IEvidenceGraphSwaggerReference {
  /** Identifies the evidence artifacts as Swagger or OpenAPI documents. */
  type: "swagger";

  /**
   * Exact Swagger or OpenAPI document location.
   *
   * A location is either a project-relative file path or an `http:`/`https:`
   * URL. Local paths are resolved below the active `ttsc` project root and may
   * name JSON or YAML documents. URLs are fetched while the project rule runs,
   * so an unavailable remote document fails the build instead of silently
   * removing its operations from the evidence graph.
   *
   * This value is an exact location, not a glob. The document is normalized
   * through `@typia/utils` to `OpenApi.IDocument` before its operations are
   * indexed. Use a claim's `reference` array when it owes separate coverage to
   * more than one Swagger document.
   *
   * Operation targets use the whitespace-free `<METHOD>:<path>` form, such as
   * `POST:/members` or `GET:/members/{id}`.
   */
  file: string;
}
