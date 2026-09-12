import type { EvidenceActiveSeverity } from "../typings/EvidenceActiveSeverity";
import type { EvidenceSymbol } from "../typings/EvidenceSymbol";
import type { IEvidenceReference } from "./IEvidenceReference";

/** One enabled reference after severity inheritance and selector defaults. */
export interface IEvidenceConfigPlanReference {
  /** Original position within the claim's reference declaration. */
  index: number;

  /** Validated reference declaration with authored paths and optional values intact. */
  population: IEvidenceReference;

  /** Effective diagnostic level after claim and reference inheritance. */
  severity: EvidenceActiveSeverity;

  /** Explicit or family-default evidence unit kinds. */
  symbols: EvidenceSymbol[];
}
