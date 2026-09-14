/**
 * Associates parsed Scaladoc with one Scala declaration site.
 *
 * Scala scanning stores attachments separately from documentation mappings so
 * extraction can retain each comment's source range and every consuming site.
 */
export interface IScalaDocumentationAttachment {
  /**
   * Identifies the declaration that owns the attached documentation.
   *
   * Consumers use this extraction identity to connect the mapping before
   * semantic units are materialized.
   */
  declarationId: string;

  /**
   * Identifies the physical declaration site that received the comment.
   *
   * A declaration can have several sites, so this prevents attachment from
   * being inferred from semantic identity alone.
   */
  siteId: string;
}
