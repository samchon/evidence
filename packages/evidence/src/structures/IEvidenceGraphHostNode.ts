import type { IEvidenceSourceLocation } from "./IEvidenceSourceLocation";

/** Obligation-scoped annotation carrier without a selected semantic claim unit. */
export interface IEvidenceGraphHostNode {
  id: string;
  boundaryId: string;
  role: "host";
  hostId: string;
  name: string;
  location: IEvidenceSourceLocation;
}
