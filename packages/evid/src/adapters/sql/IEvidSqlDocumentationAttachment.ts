/** Connects one SQL documentation carrier to a physical declaration site.
 *
 * This separate record lets a single leading comment acknowledge declarations
 * that share a source location, such as an inline relation and its column.
 */
export interface IEvidSqlDocumentationAttachment {
  /** Names the extraction record for the documented declaration.
   *
   * The value resolves within the file analysis that owns this attachment.
   */
  declarationId: string;

  /** Names the physical site through which the semantic unit is documented.
   *
   * This remains distinct from `declarationId` when identities merge across
   * more than one site.
   */
  siteId: string;
}
