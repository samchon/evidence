import type { ISqlFileAnalysis } from "../sql/ISqlFileAnalysis";
import type { IPostgresqlReference } from "./IPostgresqlReference";

/**
 * Extends SQL analysis with PostgreSQL declarations that need an existing owner.
 *
 * ALTER and COMMENT statements can contribute sites in a different file from
 * the declaration whose semantic identity they extend.
 */
export interface IPostgresqlFileAnalysis extends ISqlFileAnalysis {
  /**
   * Lists declarations whose owner must be resolved after all files are scanned.
   *
   * Omission means this file has no ALTER or COMMENT sites needing cross-file ownership.
   */
  references?: IPostgresqlReference[];
}
