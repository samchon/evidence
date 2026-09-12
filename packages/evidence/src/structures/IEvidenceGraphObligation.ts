import type { IEvidenceGraphEdge } from "./IEvidenceGraphEdge";

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
}
