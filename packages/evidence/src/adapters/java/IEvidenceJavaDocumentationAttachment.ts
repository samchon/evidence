/**
 * Connects a Javadoc carrier to one physical Java declaration site.
 *
 * EvidenceJavaFileScanner records this source adjacency, and EvidenceJavaAdapter maps
 * the local declaration to a reconciled unit without sharing the comment across
 * overloads.
 */
export interface IEvidenceJavaDocumentationAttachment {
  /**
   * Scanner-local declaration receiving this Javadoc carrier.
   *
   * Materialization maps it to a reconciled semantic unit.
   */
  declarationId: string;

  /**
   * Physical site that owns an evidence host for the declaration.
   *
   * This avoids treating comments as transferable among overloads.
   */
  siteId: string;
}
