/**
 * Carries the enclosing aggregate or enum while its nested C members are scanned.
 *
 * Fields and enumerators derive their ownership and semantic path from this
 * context. Keeping the declaration key as well as the path allows later
 * materialization to attach the member to the exact selected parent unit.
 */
export interface ICTypeContext {
  /** Scanner-local declaration key for the enclosing aggregate or enum. */
  declarationId: string;

  /** Canonical enclosing path prepended to each nested member identity. */
  identity: string[];
}
