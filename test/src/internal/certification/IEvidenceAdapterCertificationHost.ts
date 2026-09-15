import type { IEvidenceHost } from "evidence";

/** Exact attachment class and semantic owners of one certification host. */
export interface IEvidenceAdapterCertificationHost {
  attachment: IEvidenceHost["attachment"];
  units: string[];
}
