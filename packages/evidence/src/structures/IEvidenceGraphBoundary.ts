import type { IEvidenceGraphHostCoverage } from "./IEvidenceGraphHostCoverage";
import type { IEvidenceGraphPolicy } from "./IEvidenceGraphPolicy";
import type { IEvidenceQueryScope } from "./IEvidenceQueryScope";

/** Independent claim/reference boundary retained by graph export. */
export interface IEvidenceGraphBoundary {
  id: string;
  claim: IEvidenceQueryScope;
  reference: IEvidenceQueryScope;
  policy: IEvidenceGraphPolicy;
  active: boolean;
  complete: boolean;
  unitIds: string[];
  coveredUnitIds: string[];
  missingUnitIds: string[];
  hostCoverage: IEvidenceGraphHostCoverage[];
}
