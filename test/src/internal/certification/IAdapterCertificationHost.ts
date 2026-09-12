import type { IEvidenceHost } from "../../../../packages/evidence/src/structures/IEvidenceHost";

/** Exact attachment class and semantic owners of one certification host. */
export interface IAdapterCertificationHost {
  attachment: IEvidenceHost["attachment"];
  units: string[];
}
