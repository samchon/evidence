import type { IEvidenceCheckReport } from "./IEvidenceCheckReport";
import type { IEvidenceGraphInput } from "./IEvidenceGraphInput";
import type { IEvidenceGraphResult } from "./IEvidenceGraphResult";

/** Materialized graph and its stable command report. */
export interface IEvidenceCheckAnalysis {
  graphInput: IEvidenceGraphInput;
  graph: IEvidenceGraphResult;
  report: IEvidenceCheckReport;
}
