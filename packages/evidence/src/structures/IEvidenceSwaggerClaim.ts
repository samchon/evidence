import type { IEvidenceClaimBase } from "./IEvidenceClaimBase";

/**
 * Swagger/OpenAPI operations that cite evidence from their descriptions.
 *
 * - File globs select local JSON/YAML documents. Each operation is a host
 *   addressed as METHOD:/path.
 * - Parse evidence, exclusion, and review tags from the operation's description.
 *   Fenced examples and other JSON/YAML string fields do not host tags.
 * - Operations without a description remain selected hosts for coverage policies.
 */
export interface IEvidenceSwaggerClaim extends IEvidenceClaimBase<
  "swagger",
  "operation"
> {}
