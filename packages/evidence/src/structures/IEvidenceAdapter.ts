import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";
import type { IEvidenceInventory } from "./IEvidenceInventory";
import type { IEvidenceSourceSnapshot } from "./IEvidenceSourceSnapshot";

/** Common source-to-inventory boundary; adapters own syntax and public-surface semantics. */
export interface IEvidenceAdapter {
  type: EvidenceArtifactType;
  /** Retains source failures and reports any accepted construct it cannot analyze completely. */
  analyze(snapshot: IEvidenceSourceSnapshot): Promise<IEvidenceInventory>;
}
