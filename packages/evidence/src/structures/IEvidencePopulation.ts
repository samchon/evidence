import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceHost } from "./IEvidenceHost";
import type { IEvidenceUnit } from "./IEvidenceUnit";

/**
 * A selected coverage denominator together with its addressable structural
 * context.
 *
 * `EvidenceInventory.select` projects explicit unit IDs from reconciled adapter
 * output. Required units, aggregate scopes, and withdrawn identities remain
 * separate so target resolution can explain a citation without changing what
 * the population requires. Hosts are narrowed to the selected semantic owners.
 *
 * For example, selecting `Client.send` can retain `Client` as an aggregate
 * scope while requiring only the method. A citation to the class can cover that
 * selected descendant through its real parent relationship; it does not add the
 * class or unrelated siblings to the denominator.
 *
 * Completeness and diagnostics belong to the underlying analysis. Narrowing a
 * selector cannot turn an incomplete inventory into a trustworthy population.
 */
export interface IEvidencePopulation {
  /**
   * Selected identities that remain eligible after withdrawal propagation.
   *
   * These units form the denominator. Several public aliases or declaration
   * sites do not make one semantic identity contribute more than once.
   */
  units: IEvidenceUnit[];

  /**
   * Selected units and the real ancestors needed for aggregate lookup.
   *
   * Ancestors need not be selected requirements. The closure follows parent
   * IDs, preserving literal name segments that happen to contain dots.
   */
  scopes: IEvidenceUnit[];

  /**
   * Withdrawn identities within the requested selection and its original
   * scopes.
   *
   * These units cannot supply ordinary coverage. Resolution keeps them to
   * distinguish a withdrawn target from an address that never existed.
   */
  hidden: IEvidenceUnit[];

  /**
   * Attached documentation positions owned by selected identities.
   *
   * Each host's owner list is narrowed to this population. Eligible hosts
   * without tags remain necessary for policies that detect a host with zero
   * evidence.
   */
  hosts: IEvidenceHost[];

  /**
   * Whether the underlying inventory was analyzed completely.
   *
   * This status is inherited even if all requested IDs happen to be present.
   * Partial extraction cannot establish that the selected denominator is
   * complete.
   */
  complete: boolean;

  /**
   * Findings from the inventory underlying this projection.
   *
   * Selection preserves these findings so a query can explain why a seemingly
   * valid subset still cannot support a complete coverage evaluation.
   */
  diagnostics: IEvidenceDiagnostic[];
}
