import type { EvidenceUnitSelection } from "../typings/EvidenceUnitSelection";
import type { IEvidenceGraphPolicy } from "./IEvidenceGraphPolicy";

/** One claim/reference obligation that selects or contains an inspected identity. */
export interface IEvidenceInspectedObligation {
  claim: number;
  reference: number;
  policy: IEvidenceGraphPolicy;
  active: boolean;
  complete: boolean;
  selection: EvidenceUnitSelection;
  covered: boolean;
  missing: boolean;
}
