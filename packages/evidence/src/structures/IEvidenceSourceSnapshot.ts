import type { IEvidenceSourceDependency } from "./IEvidenceSourceDependency";
import type { IEvidenceSourceDiagnostic } from "./IEvidenceSourceDiagnostic";
import type { IEvidenceSourceFile } from "./IEvidenceSourceFile";
import type { IEvidenceSourceRoot } from "./IEvidenceSourceRoot";

/** Deterministic discovery output; partial files never imply complete coverage. */
export interface IEvidenceSourceSnapshot {
  /** Root spelling shared by this population's logical addresses. */
  root: IEvidenceSourceRoot;

  /** Physical files ordered by their first selected address. May be partial on failure. */
  files: IEvidenceSourceFile[];

  /** Existing and missing locations needed to notice changes or repairs. */
  dependencies: IEvidenceSourceDependency[];

  /** Discovery failures, retained even when no files could be loaded. */
  diagnostics: IEvidenceSourceDiagnostic[];

  /** True only when discovery has no failures; an empty complete result is valid. */
  complete: boolean;
}
