import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";
import type { EvidenceSymbol } from "../typings/EvidenceSymbol";
import type { IEvidenceUnitSite } from "./IEvidenceUnitSite";
import type { IEvidenceWithdrawal } from "./IEvidenceWithdrawal";

/** A semantic identity, independent of public aliases and population selectors. */
export interface IEvidenceUnit {
  /** Adapters merge declarations only when their language establishes one identity. */
  id: string;
  parentId?: string;
  type: EvidenceArtifactType;
  symbol: EvidenceSymbol;
  /** Literal accessor segments; dots inside a segment never imply ownership. */
  identity: string[];
  name: string;
  /** Adapter-supplied digest of this unit's own normalized semantic content. */
  contentDigest?: string;
  sites: IEvidenceUnitSite[];
  withdrawals: IEvidenceWithdrawal[];
}
