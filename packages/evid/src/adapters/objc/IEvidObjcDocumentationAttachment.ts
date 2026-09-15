/**
 * Connects one Doxygen carrier to a physical Objective-C declaration site.
 *
 * Interface and implementation records may later share a semantic unit, but
 * this attachment retains the exact source site that owns the annotation.
 */
export interface IEvidObjcDocumentationAttachment {
  /**
   * Physical declaration receiving the documentation.
   *
   * The adapter resolves this extraction ID to its published unit when possible.
   */
  declarationId: string;

  /**
   * Eligible declaration site containing the carrier.
   *
   * This retains the exact source host when declarations later merge.
   */
  siteId: string;
}
