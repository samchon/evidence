import type { IEvidDeclaration } from "../structures/IEvidDeclaration";
import type { EvidSeverity } from "../typings/EvidSeverity";

/**
 * A checklist annotation awaiting host assignment.
 *
 * Checklists are held while other declarations establish structural ownership,
 * preventing a source-order coincidence from discarding a valid obligation.
 */
export interface IEvidUnhostedChecklist {
  /**
   * Authored checklist declaration retained for later attachment or
   * diagnostics.
   *
   * The graph holds this source record until structural ownership establishes
   * which selected claim units its host can affect.
   */
  declaration: IEvidDeclaration;

  /**
   * Effective severity after claim and reference policy inheritance.
   *
   * This resolved value lets later attachment report the applicable policy
   * without repeating policy inheritance.
   */
  severity: EvidSeverity;

  /**
   * Index of the owning claim in the resolved configuration plan.
   *
   * It preserves the claim occurrence that supplied this checklist when plans
   * contain repeated populations.
   */
  claim: number;

  /**
   * Index of the owning reference within that claim.
   *
   * Together with {@link claim}, this identifies the configured reference whose
   * severity and selection apply to the deferred checklist.
   */
  reference: number;
}
