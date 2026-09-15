import type { EvidParseSession } from "../../parsers/EvidParseSession";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { EvidDatabaseType } from "../../typings/EvidDatabaseType";
import type { IEvidSqlFileAnalysis } from "./IEvidSqlFileAnalysis";

/**
 * Dialect-specific hooks consumed by the shared SQL inventory adapter.
 *
 * Scanning owns syntax and declaration interpretation; an optional resolver can
 * connect ownership across files. The shared adapter runs these phases before
 * materializing units and documentation under a single parser lifecycle.
 */
export interface IEvidSqlAdapterOptions {
  /**
   * Explicit database family used for grammar selection and inventory type.
   *
   * Shared .sql extensions do not permit falling back to another dialect on failure.
   */
  type: EvidDatabaseType;

  /**
   * Copies one borrowed syntax tree into serializable declaration and host records.
   *
   * Returned analysis must not retain native nodes after the parse callback ends;
   * unsupported extraction should preserve diagnostics and incomplete state.
   */
  scan: (
    session: EvidParseSession,
    source: IEvidSourceFile,
  ) => IEvidSqlFileAnalysis;

  /**
   * Reconciles cross-file declaration and documentation ownership before publication.
   *
   * The hook mutates copied file analyses after every scan has completed. Omission
   * means the dialect scanner already established the ownership needed for materialization.
   */
  resolve?: (analyses: IEvidSqlFileAnalysis[]) => void;
}
