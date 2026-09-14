/**
 * Connects a DartDoc carrier to one extracted declaration site.
 *
 * DartFileScanner records source-adjacent attachments here, allowing the
 * documentation pass to evaluate one carrier against each declaration site it
 * governs without making the comment itself own a semantic unit.
 */
export interface IDartDocumentationAttachment {
  /**
   * Identifies the declaration extraction record that receives the DartDoc.
   *
   * Consumers use this stable scanner-local ID to find the declaration before
   * evaluating its annotation against the declaration's semantic unit.
   */
  declarationId: string;

  /**
   * Identifies the physical declaration site covered by the DartDoc.
   *
   * A semantic unit can have multiple sites, so this keeps attachment scoped to
   * the adjacent source occurrence instead of every site with the same unit ID.
   */
  siteId: string;
}
