import type { EvidenceSeverity } from "../typings/EvidenceSeverity";
import type { IEvidenceClaim } from "./IEvidenceClaim";

/** Evidence graph configuration. Each claim owns independent coverage obligations. */
export interface IEvidenceConfig {
  /**
   * Default diagnostic level. Claims and references may override inherited severity.
   *
   * @default error
   */
  severity?: EvidenceSeverity | undefined;

  /** Claim populations and their required evidence. Must contain at least one claim. */
  claims: IEvidenceClaim[];
}
