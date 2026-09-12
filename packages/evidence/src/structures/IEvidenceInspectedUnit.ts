import type { IEvidenceFingerprint } from "./IEvidenceFingerprint";
import type { IEvidenceHost } from "./IEvidenceHost";
import type { IEvidenceListItem } from "./IEvidenceListItem";

/** One resolved or ambiguous identity with its current structural context. */
export interface IEvidenceInspectedUnit {
  item: IEvidenceListItem;
  children: IEvidenceListItem[];
  hosts: IEvidenceHost[];
  fingerprint?: IEvidenceFingerprint;
}
