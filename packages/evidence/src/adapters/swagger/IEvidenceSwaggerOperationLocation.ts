import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IEvidenceYamlScalarMapping } from "./IEvidenceYamlScalarMapping";

/**
 * Source spans for one normalized Swagger operation and its description.
 *
 * Locations are optional on operations because OpenAPI conversion can preserve
 * semantics for values that do not map to one source token.
 */
export interface IEvidenceSwaggerOperationLocation {
  /**
   * Locates the full operation node used as the physical unit site.
   *
   * The range keeps diagnostics and fingerprints tied to the original document.
   */
  range: IEvidenceSourceRange;

  /**
   * Maps description characters when the scalar has a source-backed location.
   *
   * Omission means converted or aliased content has no direct scalar token.
   */
  description?: IEvidenceYamlScalarMapping;
}
