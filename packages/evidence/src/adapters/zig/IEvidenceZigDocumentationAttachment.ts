/**
 * Associates parsed Zig documentation with one declaration site.
 *
 * The adapter stores this relation beside documentation mappings so semantic
 * assembly can preserve the original comment attachment.
 */
export interface IEvidenceZigDocumentationAttachment {
  /**
   * Identifies the declaration that owns the documentation mapping.
   *
   * Consumers use the extraction identity before assigning documentation to a
   * semantic unit.
   */
  declarationId: string;

  /**
   * Identifies the physical declaration site that receives the comment.
   *
   * This keeps attachment precise when one semantic unit has several sites.
   */
  siteId: string;
}
