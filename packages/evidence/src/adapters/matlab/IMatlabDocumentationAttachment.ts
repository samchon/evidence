/**
 * Connects one MATLAB help carrier to a physical declaration site.
 *
 * The pair distinguishes source attachment from a unit's semantic identity;
 * later ownership reconciliation may merge several sites into that one unit.
 */
export interface IMatlabDocumentationAttachment {
  /** Owning declaration extraction identity. */
  declarationId: string;

  /** Physical declaration site owned by the semantic unit. */
  siteId: string;
}
