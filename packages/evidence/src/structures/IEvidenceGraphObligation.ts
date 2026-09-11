import type { IEvidenceGraphEdge } from "./IEvidenceGraphEdge";
import type { IEvidenceGraphHostCoverage } from "./IEvidenceGraphHostCoverage";

/** Coverage ledger for one claim/reference pair. */
export interface IEvidenceGraphObligation {
  claim: number;
  reference: number;
  active: boolean;
  complete: boolean;
  unitIds: string[];
  coveredUnitIds: string[];
  missingUnitIds: string[];
  edges: IEvidenceGraphEdge[];
  /** Per-host checklist coverage; otherwise empty. */
  hostCoverage: IEvidenceGraphHostCoverage[];
}
