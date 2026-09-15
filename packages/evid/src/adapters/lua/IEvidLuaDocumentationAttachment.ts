/**
 * Connects a LuaDoc carrier to one extracted Lua declaration site.
 *
 * EvidLuaFileScanner records this source-adjacent pair before static value handling,
 * so the documentation pass can evaluate annotations without giving comments
 * ownership of the declaration's semantic unit.
 */
export interface IEvidLuaDocumentationAttachment {
  /**
   * Identifies the declaration extraction record that receives the LuaDoc.
   *
   * Consumers use this stable scanner-local ID to locate the declaration whose
   * annotation needs evaluation.
   */
  declarationId: string;

  /**
   * Identifies the physical declaration site covered by the LuaDoc.
   *
   * This keeps an attachment at its adjacent source occurrence when aliases or
   * table members cause one semantic unit to have several sites.
   */
  siteId: string;
}
