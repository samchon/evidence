/**
 * Describes one ordered endpoint of a DBML relation awaiting resolution.
 *
 * The scanner preserves literal schema, table, and column segments so the
 * resolver can match them against selected declarations across files.
 */
export interface IEvidDbmlEndpoint {
  /**
   * Names the endpoint table with explicit schema and table segments.
   *
   * Omission of a DBML schema becomes the `public` schema before this value is
   * stored.
   */
  table: string[];

  /**
   * Lists endpoint columns in composite-key order.
   *
   * Position pairs each local column with the column at the same position on
   * the peer endpoint.
   */
  columns: string[];
}
