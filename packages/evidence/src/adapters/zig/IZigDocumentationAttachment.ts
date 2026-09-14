/** One Zig documentation carrier attached to a Zig declaration site. */
export interface IZigDocumentationAttachment {
  /** Owning declaration extraction identity. */
  declarationId: string;

  /** Physical declaration site owned by the semantic unit. */
  siteId: string;
}
