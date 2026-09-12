import type { EvidenceSymbol } from "../typings/EvidenceSymbol";
import type { EvidenceUnitSelection } from "../typings/EvidenceUnitSelection";
import type { IEvidenceQueryScope } from "./IEvidenceQueryScope";
import type { IEvidenceSourceLocation } from "./IEvidenceSourceLocation";

/** One configured semantic identity and every accepted public spelling. */
export interface IEvidenceListItem {
  id: string;
  scope: IEvidenceQueryScope;
  unitId: string;
  symbol: EvidenceSymbol;
  name: string;
  selection: EvidenceUnitSelection;
  target: string;
  aliases: string[];
  locations: IEvidenceSourceLocation[];
}
