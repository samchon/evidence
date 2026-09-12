import type { EvidenceActiveSeverity } from "../typings/EvidenceActiveSeverity";
import type { EvidenceSymbol } from "../typings/EvidenceSymbol";
import type { IEvidenceClaim } from "./IEvidenceClaim";
import type { IEvidenceConfigPlanReference } from "./IEvidenceConfigPlanReference";

/** One enabled claim and the references that still create obligations. */
export interface IEvidenceConfigPlanClaim {
  /** Original position retained for graph diagnostics. */
  index: number;

  /** Validated claim declaration with authored paths and optional values intact. */
  population: IEvidenceClaim;

  /** Effective diagnostic level after root and claim inheritance. */
  severity: EvidenceActiveSeverity;

  /** Explicit or family-default claim host kinds. */
  symbols: EvidenceSymbol[];

  /** Enabled references; their indexes remain relative to the authored array. */
  references: IEvidenceConfigPlanReference[];
}
