/** One DocC carrier attached to a Swift declaration site. */
export interface ISwiftDocumentationAttachment {
  /** Owning declaration extraction identity. */
  declarationId: string;

  /** Physical declaration site owned by the semantic unit. */
  siteId: string;
}
