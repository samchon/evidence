/**
 * Requests ownership resolution for a PostgreSQL declaration site.
 *
 * The adapter uses this record after scanning all files to merge ALTER and
 * COMMENT sites with the declaration identified by their SQL identity.
 */
export interface IEvidPostgresqlReference {
  /**
   * Identifies the local declaration that receives the resolved owner.
   *
   * This ID remains stable while resolution replaces its provisional identity.
   */
  declarationId: string;

  /**
   * Names the schema-qualified table or column to resolve.
   *
   * Table identities have two segments, while column identities have three.
   */
  identity: string[];

  /**
   * Distinguishes a COMMENT site from an ALTER TABLE extension.
   *
   * Comment sites retain a separate physical address after ownership
   * resolution.
   */
  comment: boolean;
}
