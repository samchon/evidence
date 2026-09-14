/**
 * Connects one Doxygen carrier to a physical Objective-C declaration site.
 *
 * Interface and implementation records may later share a semantic unit, but
 * this attachment retains the exact source site that owns the annotation.
 */
export interface IObjcDocumentationAttachment {
  /** Physical declaration receiving the documentation. */
  declarationId: string;

  /** Eligible declaration site containing the carrier. */
  siteId: string;
}
