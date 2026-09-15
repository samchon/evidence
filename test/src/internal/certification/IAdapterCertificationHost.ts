import type { IEvidHost } from "evid";

/** Exact attachment class and semantic owners of one certification host. */
export interface IAdapterCertificationHost {
  attachment: IEvidHost["attachment"];
  units: string[];
}
