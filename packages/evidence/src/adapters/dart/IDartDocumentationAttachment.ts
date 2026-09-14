/** One Dart documentation carrier attached to a Dart declaration site. */
export interface IDartDocumentationAttachment {
  /** Owning declaration extraction identity. */
  declarationId: string;

  /** Physical declaration site owned by the semantic unit. */
  siteId: string;
}
