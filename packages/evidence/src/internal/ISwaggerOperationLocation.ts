import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";
import type { IYamlScalarMapping } from "./IYamlScalarMapping";

/** Source spans for one normalized Swagger operation and its description. */
export interface ISwaggerOperationLocation {
  range: IEvidenceSourceRange;
  description?: IYamlScalarMapping;
}
