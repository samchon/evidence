import type { EvidActiveSeverity } from "../typings/EvidActiveSeverity";
import type { EvidSymbol } from "../typings/EvidSymbol";
import type { IEvidReference } from "./IEvidReference";

/**
 * One enabled reference prepared to select its required evidence units.
 *
 * The plan keeps the authored reference alongside effective severity and symbol
 * defaults. Materialization uses these resolved settings to construct a target
 * population independently of the claim's host selection or neighboring references.
 */
export interface IEvidConfigPlanReference {
  /**
   * Zero-based position in the claim's authored reference declaration.
   *
   * Filtering inactive references does not renumber this value. A single reference
   * has index zero after normalization to the execution sequence.
   */
  index: number;

  /**
   * Validated reference retaining its authored artifact settings.
   *
   * Paths and optional policy flags remain available for materialization. Resolved
   * severity and symbol choices are recorded separately rather than written back.
   */
  population: IEvidReference;

  /**
   * Active severity after inheriting or overriding the claim's level.
   *
   * Off references do not enter the plan. This severity attributes findings from
   * discovery, extraction, resolution, and coverage to this obligation.
   */
  severity: EvidActiveSeverity;

  /**
   * Explicit or artifact-default kinds forming the reference denominator.
   *
   * Unselected real ancestors can still become aggregate resolution scopes after
   * inventory selection; they do not become additional required units.
   */
  symbols: EvidSymbol[];
}
