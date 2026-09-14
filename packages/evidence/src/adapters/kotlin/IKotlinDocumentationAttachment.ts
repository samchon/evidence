/** One KDoc carrier attached to a Kotlin declaration site. */
export interface IKotlinDocumentationAttachment {
  /** Owning declaration extraction identity. */
  declarationId: string;

  /** Physical declaration site owned by the semantic unit. */
  siteId: string;
}
