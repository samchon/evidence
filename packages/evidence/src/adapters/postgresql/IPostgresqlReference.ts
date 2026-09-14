/** Resolves an additional declaration site against a schema-qualified identity. */
export interface IPostgresqlReference {
  /** Local declaration receiving the resolved owner or original identity. */
  declarationId: string;
  /** Schema-qualified table or column identity. */
  identity: string[];
  /** Whether this is a COMMENT site rather than an ALTER table extension. */
  comment: boolean;
}
