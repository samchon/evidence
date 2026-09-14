import { SqlAdapter } from "../sql/SqlAdapter";
import { SqliteFileScanner } from "./SqliteFileScanner";

/**
 * Extracts SQLite's explicitly declared tables, columns, and foreign keys.
 *
 * SQLiteFileScanner supplies dialect-specific ownership and identifier rules to
 * the shared SQL materializer. Analysis uses captured DDL source and does not
 * open a database or infer schema by executing statements.
 */
export class EvidenceSqliteAdapter extends SqlAdapter {
  /**
   * Selects SQLite grammar and declaration scanning for the shared adapter lifecycle.
   *
   * Parser allocation and source analysis wait until analyze receives a snapshot.
   */
  public constructor() {
    super({
      type: "sqlite",
      scan: (session, source) => new SqliteFileScanner(session, source).scan(),
    });
  }
}
