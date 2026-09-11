import type { IEvidenceDeclaration } from "../structures/IEvidenceDeclaration";
import type { EvidenceSeverity } from "../typings/EvidenceSeverity";

/** Deferred checklist declaration that may still answer another obligation. */
export interface IEvidenceUnhostedChecklist {
  declaration: IEvidenceDeclaration;
  severity: EvidenceSeverity;
  claim: number;
  reference: number;
}
