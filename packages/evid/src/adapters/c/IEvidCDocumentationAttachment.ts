/**
 * Associates one Doxygen carrier with one eligible C declaration position.
 *
 * A declaration can expose several sites through grouped declarators, so the
 * declaration key alone is insufficient. The site key identifies the exact host
 * retained by inventory materialization.
 */
export interface IEvidCDocumentationAttachment {
  /**
   * Scanner-local declaration key for the semantic owner candidate.
   *
   * Materialization maps it to a selected unit only after declaration grouping.
   */
  declarationId: string;

  /**
   * Physical declaration site that accepts the preceding documentation.
   *
   * It prevents a shared declaration family from borrowing a different
   * occurrence's comment.
   */
  siteId: string;
}
