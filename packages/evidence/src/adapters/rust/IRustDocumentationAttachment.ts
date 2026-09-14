/**
 * Links a Rust documentation carrier to one declaration site.
 *
 * Its scanner-local identifiers allow the adapter to group shared sites after
 * aliases resolve without confusing documentation identity with public address.
 */
export interface IRustDocumentationAttachment {
  /**
   * Scanner identity of the declaration receiving this documentation.
   *
   * The adapter resolves it to a published unit before tags can alter withdrawals.
   */
  declarationId: string;

  /**
   * Shared physical-site identity for co-located units.
   *
   * It makes their documentation produce one host instead of duplicates.
   */
  siteId: string;
}
