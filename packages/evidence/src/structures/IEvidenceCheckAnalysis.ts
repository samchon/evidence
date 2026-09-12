import type { IEvidenceCheckReport } from "./IEvidenceCheckReport";
import type { IEvidenceGraphResult } from "./IEvidenceGraphResult";

/** Materialized graph and its stable command report. */
export interface IEvidenceCheckAnalysis {
  graph: IEvidenceGraphResult;
  report: IEvidenceCheckReport;
}
