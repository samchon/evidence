import type { EvidenceActiveSeverity } from "../typings/EvidenceActiveSeverity";
import type { EvidenceSymbol } from "../typings/EvidenceSymbol";
import type { IEvidenceClaim } from "./IEvidenceClaim";
import type { IEvidenceConfigPlanReference } from "./IEvidenceConfigPlanReference";

/**
 * One enabled claim with resolved host selectors and reference policies.
 *
 * Planning preserves the authored population for paths and artifact-specific
 * settings while recording effective severity and symbol choices separately.
 * Materialization can therefore select hosts without repeating configuration
 * inheritance or losing the original declaration used in diagnostics.
 */
export interface IEvidenceConfigPlanClaim {
  /**
   * Zero-based position in the authored claim array.
   *
   * This survives inactive-claim filtering so a finding still identifies the
   * declaration the user wrote rather than its position in the filtered plan.
   */
  index: number;

  /**
   * Validated claim retaining authored paths and optional settings.
   *
   * Effective severity and selector defaults are stored separately. Keeping
   * this declaration intact avoids replacing user intent with normalized
   * defaults.
   */
  population: IEvidenceClaim;

  /**
   * Effective diagnostic severity after claim inheritance.
   *
   * This is always active because off claims have already been filtered. It
   * becomes the inherited default for this claim's reference plans.
   */
  severity: EvidenceActiveSeverity;

  /**
   * Explicit or default symbol kinds eligible to host this claim's Evidence.
   *
   * These are host selectors. Each reference has its own selector list for the
   * target units that those hosts must acknowledge.
   */
  symbols: EvidenceSymbol[];

  /**
   * Enabled references that independently require Evidence from this claim.
   *
   * Each retains its authored index and effective settings. Identical
   * selections remain separate obligations and may apply different exclusion or
   * review rules.
   */
  references: IEvidenceConfigPlanReference[];
}
