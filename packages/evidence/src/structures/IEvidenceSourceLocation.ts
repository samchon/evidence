import type { IEvidenceSourceRange } from "./IEvidenceSourceRange";

/** Diagnostic or declaration location; file-level failures need no source span. */
export interface IEvidenceSourceLocation {
  file: string;
  range?: IEvidenceSourceRange;
}
