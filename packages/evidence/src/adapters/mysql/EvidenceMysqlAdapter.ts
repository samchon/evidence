import { MysqlFileScanner } from "./MysqlFileScanner";
import { SqlAdapter } from "../sql/SqlAdapter";

/** Analyzes explicitly configured MySQL source schemas with static table ownership. */
export class EvidenceMysqlAdapter extends SqlAdapter {
  /** Uses the shared parser lifecycle and database inventory materializer. */
  public constructor() {
    super({ type: "mysql", scan: MysqlFileScanner.scan });
  }
}
