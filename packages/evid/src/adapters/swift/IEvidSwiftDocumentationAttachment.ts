/**
 * Associates parsed DocC with one Swift declaration site.
 *
 * The scanner keeps this relation separate from comment mappings so semantic
 * assembly can attach documentation without losing its source range.
 */
export interface IEvidSwiftDocumentationAttachment {
  /**
   * Identifies the declaration that owns the attached DocC mapping.
   *
   * This extraction identity remains stable while the adapter constructs units
   * and their documentation references.
   */
  declarationId: string;

  /**
   * Identifies the declaration site at which the DocC comment appears.
   *
   * The site disambiguates extensions and other declarations contributing to
   * the same semantic unit.
   */
  siteId: string;
}
