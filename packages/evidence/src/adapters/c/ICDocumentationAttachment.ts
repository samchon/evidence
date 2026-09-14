/**
 * Associates one Doxygen carrier with one eligible C declaration position.
 *
 * A declaration can expose several sites through grouped declarators, so the
 * declaration key alone is insufficient. The site key identifies the exact
 * host retained by inventory materialization.
 */
export interface ICDocumentationAttachment {
  /** Scanner-local declaration key for the semantic owner candidate. */
  declarationId: string;

  /** Physical declaration site that accepts the preceding documentation. */
  siteId: string;
}
