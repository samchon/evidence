import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceHost } from "./IEvidenceHost";
import type { IEvidenceUnit } from "./IEvidenceUnit";

/** An independent selection projected from the complete immutable inventory. */
export interface IEvidencePopulation {
  /** Selected, non-withdrawn obligations. */
  units: IEvidenceUnit[];
  /** Selected units and their actual structural ancestors. */
  scopes: IEvidenceUnit[];
  /** Withdrawn units that would otherwise belong to the selection or its scopes. */
  hidden: IEvidenceUnit[];
  /** Attached hosts projected onto the selected semantic identities. */
  hosts: IEvidenceHost[];
  complete: boolean;
  diagnostics: IEvidenceDiagnostic[];
}
