import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IYamlScalarMapping } from "./IYamlScalarMapping";

/** Source spans for one normalized Swagger operation and its description.
 *
 * Locations are optional on operations because OpenAPI conversion can preserve
 * semantics for values that do not map to one source token.
 */
export interface ISwaggerOperationLocation {
  /** Full operation node span used as the unit site. */
  range: IEvidenceSourceRange;

  /** Character-level mapping for a description scalar, when source-backed. */
  description?: IYamlScalarMapping;
}
