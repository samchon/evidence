import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";

/** One Python declaration position eligible to host documentation. */
export interface IPythonHostPosition {
  id: string;
  siteId: string;
  range: IEvidenceSourceRange;
  unitIds: string[];
}
