/** One MATLAB help carrier attached to a Matlab declaration site. */
export interface IMatlabDocumentationAttachment {
  /** Owning declaration extraction identity. */
  declarationId: string;

  /** Physical declaration site owned by the semantic unit. */
  siteId: string;
}
