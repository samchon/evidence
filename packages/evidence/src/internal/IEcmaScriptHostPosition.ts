import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";

/** One declaration position eligible to host JSDoc. */
export interface IEcmaScriptHostPosition {
  id: string;
  siteId: string;
  range: IEvidenceSourceRange;
  unitIds: string[];
}
