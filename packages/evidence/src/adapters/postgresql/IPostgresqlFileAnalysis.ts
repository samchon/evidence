import type { ISqlFileAnalysis } from "../sql/ISqlFileAnalysis";
import type { IPostgresqlReference } from "./IPostgresqlReference";

/** Retains PostgreSQL cross-file ownership requests without parser nodes. */
export interface IPostgresqlFileAnalysis extends ISqlFileAnalysis {
  /** ALTER and COMMENT declarations requiring a selected owning table. */
  references?: IPostgresqlReference[];
}
