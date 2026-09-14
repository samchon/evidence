/** One Doxygen carrier attached to an Objective-C declaration site. */
export interface IObjcDocumentationAttachment {
  /** Physical declaration receiving the documentation. */
  declarationId: string;

  /** Eligible declaration site containing the carrier. */
  siteId: string;
}
