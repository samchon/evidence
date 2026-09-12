import type { IEvidenceSourceLocation } from "./IEvidenceSourceLocation";

/** Common target-bearing fields shared by acknowledgements and reviews. */
export interface IEvidenceTargetStatement {
  /** Documentation host that contains the statement. */
  hostId: string;

  /** Authored target token; resolution applies the referenced artifact's grammar. */
  target: string;

  /** Exact source position of the statement. */
  location: IEvidenceSourceLocation;
}
