import { SqlAdapter } from "../sql/SqlAdapter";
import { SqliteFileScanner } from "./SqliteFileScanner";

/** Extracts SQLite's explicit declared tables, columns, and foreign keys. */
export class EvidenceSqliteAdapter extends SqlAdapter {
  /** Uses the configured SQLite grammar and never opens a database connection. */
  public constructor() {
    super({
      type: "sqlite",
      scan: (session, source) => new SqliteFileScanner(session, source).scan(),
    });
  }
}
