/** One Scaladoc carrier attached to a Scala declaration site. */
export interface IScalaDocumentationAttachment {
  /** Owning declaration extraction identity. */
  declarationId: string;

  /** Physical declaration site owned by the semantic unit. */
  siteId: string;
}
