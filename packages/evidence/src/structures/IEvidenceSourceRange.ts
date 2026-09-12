import type { IEvidenceSourcePosition } from "./IEvidenceSourcePosition";

/** Half-open source span: start is inclusive and end is exclusive. */
export interface IEvidenceSourceRange {
  start: IEvidenceSourcePosition;
  end: IEvidenceSourcePosition;
}
