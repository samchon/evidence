/** An ordered relation endpoint resolved against selected schema declarations. */
export interface IDbmlEndpoint {
  /** Explicit schema and table segments; public is the default schema. */
  table: string[];

  /** Literal column names in composite-key order. */
  columns: string[];
}
