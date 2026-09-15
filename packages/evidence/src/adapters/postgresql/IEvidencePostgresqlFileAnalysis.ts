import type { IEvidenceSqlFileAnalysis } from "../sql/IEvidenceSqlFileAnalysis";
import type { IEvidencePostgresqlReference } from "./IEvidencePostgresqlReference";

/**
 * Extends SQL analysis with PostgreSQL declarations that need an existing
 * owner.
 *
 * ALTER and COMMENT statements can contribute sites in a different file from
 * the declaration whose semantic identity they extend.
 */
export interface IEvidencePostgresqlFileAnalysis extends IEvidenceSqlFileAnalysis {
  /**
   * Lists declarations whose owner must be resolved after all files are
   * scanned.
   *
   * Omission means this file has no ALTER or COMMENT sites needing cross-file
   * ownership.
   */
  references?: IEvidencePostgresqlReference[];
}
