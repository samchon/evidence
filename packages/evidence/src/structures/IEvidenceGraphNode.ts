import type { EvidenceSymbol } from "../typings/EvidenceSymbol";
import type { EvidencePopulationRole } from "../typings/EvidencePopulationRole";
import type { EvidenceUnitSelection } from "../typings/EvidenceUnitSelection";
import type { IEvidenceSourceLocation } from "./IEvidenceSourceLocation";

/** One obligation-scoped identity in a graph export. */
export interface IEvidenceGraphNode {
  id: string;
  boundaryId: string;
  role: EvidencePopulationRole;
  unitId: string;
  symbol: EvidenceSymbol;
  name: string;
  target: string;
  selection: EvidenceUnitSelection;
  covered: boolean;
  missing: boolean;
  locations: IEvidenceSourceLocation[];
}
