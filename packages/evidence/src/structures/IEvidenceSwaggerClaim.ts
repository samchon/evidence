import type { IEvidenceClaimBase } from "./IEvidenceClaimBase";

/**
 * Swagger/OpenAPI operations that cite Evidence from their descriptions.
 *
 * Each HTTP method and path identifies one semantic operation host. Description
 * text provides its annotation carrier, but host participation does not depend
 * on already having written documentation; otherwise undocumented operations
 * could disappear from policies that require every selected host to answer.
 *
 * - File globs select local JSON/YAML documents. Each operation is a host
 *   addressed as METHOD:/path.
 * - Parse Evidence, exclusion, and review tags from the operation's description.
 *   Fenced examples and other JSON/YAML string fields do not host tags.
 * - Operations without a description remain selected hosts for coverage policies.
 */
export interface IEvidenceSwaggerClaim extends IEvidenceClaimBase<
  "swagger",
  "operation"
> {}
