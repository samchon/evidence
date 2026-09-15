import type { EvidUnitSelection } from "../typings/EvidUnitSelection";
import type { IEvidGraphPolicy } from "./IEvidGraphPolicy";

/**
 * Coverage state of an inspected identity within one reference obligation.
 *
 * A selected unit reports its direct ledger state. An addressable ancestor can
 * summarize its selected descendants without itself increasing the denominator.
 * Activation and completeness remain explicit so a partial analysis is not
 * mistaken for a trustworthy coverage result.
 */
export interface IEvidInspectedObligation {
  /**
   * Authored claim index owing the inspected requirement.
   *
   * Other claims evaluate the same reference identity independently.
   */
  claim: number;

  /**
   * Authored reference index defining the requirement population.
   *
   * This identifies the ledger and effective policy used for the displayed state.
   */
  reference: number;

  /**
   * Effective acknowledgement and review rules for this obligation.
   *
   * These explain why an edge accepted elsewhere may not cover the same identity here.
   */
  policy: IEvidGraphPolicy;

  /**
   * Whether the obligation participates in the evaluated graph.
   *
   * Inactive entries do not contribute to active coverage totals.
   */
  active: boolean;

  /**
   * Whether this obligation's analysis established a complete population.
   *
   * Coverage flags on an incomplete result cannot certify a full pass.
   */
  complete: boolean;

  /**
   * Whether the inspected identity is selected or supplies structural context.
   *
   * Ancestors summarize descendant requirements without adding another selected unit.
   */
  selection: EvidUnitSelection;

  /**
   * Whether the identity is directly covered or all selected descendants of an ancestor are covered.
   *
   * Ancestor coverage requires at least one selected descendant, avoiding a vacuous pass.
   */
  covered: boolean;

  /**
   * Whether the identity or any selected descendant remains missing.
   *
   * This exposes an aggregate scope's remaining requirement even when some of its
   * descendants already have accepted evidence.
   */
  missing: boolean;
}
