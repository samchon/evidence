/**
 * Connects one MATLAB help carrier to a physical declaration site.
 *
 * The pair distinguishes source attachment from a unit's semantic identity;
 * later ownership reconciliation may merge several sites into that one unit.
 */
export interface IEvidMatlabDocumentationAttachment {
  /**
   * Identifies the scanner-local declaration receiving this help carrier.
   *
   * Materialization resolves it to a semantic unit after class-folder ownership is known.
   */
  declarationId: string;

  /**
   * Identifies the physical declaration site owned by the eventual semantic unit.
   *
   * This keeps a shared class unit's source hosts distinct across selected files.
   */
  siteId: string;
}
