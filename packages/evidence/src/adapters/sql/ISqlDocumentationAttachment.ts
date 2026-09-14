/** One KDoc carrier attached to a Sql declaration site. */
export interface ISqlDocumentationAttachment {
  /** Owning declaration extraction identity. */
  declarationId: string;

  /** Physical declaration site owned by the semantic unit. */
  siteId: string;
}
