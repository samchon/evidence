import { MysqlFileScanner } from "./MysqlFileScanner";
import { SqlAdapter } from "../sql/SqlAdapter";

/**
 * Extracts explicitly configured MySQL schema declarations with static ownership.
 *
 * MysqlFileScanner supplies MySQL identifier, table, and member records to the
 * common SQL materializer. Schema meaning comes from selected source statements;
 * the adapter neither connects to a server nor executes migrations.
 */
export class EvidenceMysqlAdapter extends SqlAdapter {
  /**
   * Selects MySQL scanning within the shared parser and inventory lifecycle.
   *
   * Construction is inert; analyze later owns the parser runtime for its snapshot.
   */
  public constructor() {
    super({ type: "mysql", scan: MysqlFileScanner.scan });
  }
}
