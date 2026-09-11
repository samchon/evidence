import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";

/** One declaration position eligible to host TypeScript documentation. */
export interface ITypeScriptHostPosition {
  id: string;
  siteId: string;
  range: IEvidenceSourceRange;
  unitIds: string[];
}
