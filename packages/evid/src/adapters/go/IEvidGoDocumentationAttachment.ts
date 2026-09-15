/**
 * Connects a Go documentation carrier to one physical declaration site.
 *
 * EvidGoFileScanner establishes this adjacency, and EvidGoAdapterBase later maps the local
 * declaration to its package-wide unit without transferring the comment.
 */
export interface IEvidGoDocumentationAttachment {
  /**
   * Scanner-local declaration that owns the adjacent Go comment run.
   *
   * The adapter resolves it to a package-wide semantic unit later.
   */
  declarationId: string;

  /**
   * Physical declaration site that becomes the evidence host.
   *
   * A shared Go unit can still retain documentation at several source sites.
   */
  siteId: string;
}
