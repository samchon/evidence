import type { IEvidenceSourceLocation } from "./IEvidenceSourceLocation";

/** Retained declaration of non-public API, propagated through structural descendants. */
export interface IEvidenceWithdrawal {
  tag: "internal" | "hidden" | "ignore";
  location: IEvidenceSourceLocation;
}
