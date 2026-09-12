import type { IEvidenceSourceDependency } from "../structures/IEvidenceSourceDependency";

/** Configuration dependencies retained even when their current scan fails. */
export interface IConfigDependencyScan {
  dependencies: IEvidenceSourceDependency[];
  cause?: unknown;
}
