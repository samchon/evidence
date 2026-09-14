/**
 * Links a PHPDoc carrier to one declaration at an adjacent source site.
 *
 * PhpAdapter resolves this scanner-local relationship only after it has created
 * public units, allowing unsupported or private attachment to remain visible.
 */
export interface IPhpDocumentationAttachment {
  /**
   * Scanner identity of the declaration receiving this documentation.
   *
   * The adapter maps it to a materialized unit before tags can affect withdrawals.
   */
  declarationId: string;

  /**
   * Shared source-site identity for the attached declaration.
   *
   * It groups accessors that must produce one documentation host.
   */
  siteId: string;
}
