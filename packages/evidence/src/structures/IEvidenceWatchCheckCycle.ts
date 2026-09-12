import type { IEvidenceCheckReport } from "./IEvidenceCheckReport";

/** One published watch cycle backed by a fresh Evidence analysis. */
export interface IEvidenceWatchCheckCycle {
  schemaVersion: 1;
  command: "check";
  watch: true;
  cycle: number;
  status: "complete" | "incomplete";
  success: boolean;
  exitCode: 0 | 1 | 2;
  report: IEvidenceCheckReport;
}
