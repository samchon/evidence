import type { IEvidenceHost } from "@wrtnlabs/evidence";

/** Exact attachment class and semantic owners of one certification host. */
export interface IAdapterCertificationHost {
  attachment: IEvidenceHost["attachment"];
  units: string[];
}
