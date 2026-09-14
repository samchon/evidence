/**
 * Connects a Javadoc carrier to one physical Java declaration site.
 *
 * JavaFileScanner records this source adjacency, and JavaAdapter maps the local
 * declaration to a reconciled unit without sharing the comment across overloads.
 */
export interface IJavaDocumentationAttachment {
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
