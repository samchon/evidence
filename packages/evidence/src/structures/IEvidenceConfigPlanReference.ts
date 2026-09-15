import type { EvidenceActiveSeverity } from "../typings/EvidenceActiveSeverity";
import type { EvidenceSymbol } from "../typings/EvidenceSymbol";
import type { IEvidenceReference } from "./IEvidenceReference";

/**
 * One enabled reference prepared to select its required Evidence units.
 *
 * The plan keeps the authored reference alongside effective severity and symbol
 * defaults. Materialization uses these resolved settings to construct a target
 * population independently of the claim's host selection or neighboring
 * references.
 */
export interface IEvidenceConfigPlanReference {
  /**
   * Zero-based position in the claim's authored reference declaration.
   *
   * Filtering inactive references does not renumber this value. A single
   * reference has index zero after normalization to the execution sequence.
   */
  index: number;

  /**
   * Validated reference retaining its authored artifact settings.
   *
   * Paths and optional policy flags remain available for materialization.
   * Resolved severity and symbol choices are recorded separately rather than
   * written back.
   */
  population: IEvidenceReference;

  /**
   * Active severity after inheriting or overriding the claim's level.
   *
   * Off references do not enter the plan. This severity attributes findings
   * from discovery, extraction, resolution, and coverage to this obligation.
   */
  severity: EvidenceActiveSeverity;

  /**
   * Explicit or artifact-default kinds forming the reference denominator.
   *
   * Unselected real ancestors can still become aggregate resolution scopes
   * after inventory selection; they do not become additional required units.
   */
  symbols: EvidenceSymbol[];
}
