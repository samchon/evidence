import type { EvidenceSeverity } from "../typings/EvidenceSeverity";
import type { IEvidenceSourceLocation } from "./IEvidenceSourceLocation";

/** Serializable finding with a stable code and a concrete repair. */
export interface IEvidenceDiagnostic {
  code: string;
  severity: Exclude<EvidenceSeverity, "off">;
  message: string;
  repair: string;
  location?: IEvidenceSourceLocation;
  /** Zero-based configuration indices; names are labels, not obligation identities. */
  claim?: number;
  reference?: number;
  hostId?: string;
  target?: string;
}
