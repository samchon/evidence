import type { IEvidenceDeclaration } from "../structures/IEvidenceDeclaration";
import type { EvidenceSeverity } from "../typings/EvidenceSeverity";

/**
 * A checklist annotation awaiting host assignment.
 *
 * Checklists are held while other declarations establish structural ownership,
 * preventing a source-order coincidence from discarding a valid obligation.
 */
export interface IEvidenceUnhostedChecklist {
  /** Authored checklist declaration retained for later attachment or diagnostics. */
  declaration: IEvidenceDeclaration;

  /** Effective severity after claim and reference policy inheritance. */
  severity: EvidenceSeverity;

  /** Index of the owning claim in the resolved configuration plan. */
  claim: number;

  /** Index of the owning reference within that claim. */
  reference: number;
}
