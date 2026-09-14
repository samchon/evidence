import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { EvidenceDatabaseType } from "../../typings/EvidenceDatabaseType";
import type { ISqlFileAnalysis } from "./ISqlFileAnalysis";

/** Independent parser and extraction contract for one configured database language. */
export interface ISqlAdapterOptions {
  /** Explicit configured dialect; parsing never guesses another language. */
  type: EvidenceDatabaseType;
  /** Copies the dialect syntax tree into serializable declarations and hosts. */
  scan: (
    session: EvidenceParseSession,
    source: IEvidenceSourceFile,
  ) => ISqlFileAnalysis;
  /** Reconciles dialect-defined ownership across selected files before publication. */
  resolve?: (analyses: ISqlFileAnalysis[]) => void;
}
