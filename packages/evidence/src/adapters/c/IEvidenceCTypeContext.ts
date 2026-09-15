/**
 * Carries the enclosing aggregate or enum while its nested C members are
 * scanned.
 *
 * Fields and enumerators derive their ownership and semantic path from this
 * context. Keeping the declaration key as well as the path allows later
 * materialization to attach the member to the exact selected parent unit.
 */
export interface IEvidenceCTypeContext {
  /**
   * Scanner-local declaration key for the enclosing aggregate or enum.
   *
   * Nested declarations retain it until the adapter resolves their selected
   * parent unit.
   */
  declarationId: string;

  /**
   * Canonical enclosing path prepended to each nested member identity.
   *
   * It keeps member identity separate from any tag or typedef public address.
   */
  identity: string[];
}
