/** One Lua documentation carrier attached to a Lua declaration site. */
export interface ILuaDocumentationAttachment {
  /** Owning declaration extraction identity. */
  declarationId: string;

  /** Physical declaration site owned by the semantic unit. */
  siteId: string;
}
