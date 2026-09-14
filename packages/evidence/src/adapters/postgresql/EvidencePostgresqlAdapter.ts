import { SqlAdapter } from "../sql/SqlAdapter";
import { PostgresqlFileScanner } from "./PostgresqlFileScanner";
import { PostgresqlOwnership } from "./PostgresqlOwnership";

/** Extracts explicitly configured PostgreSQL declared table schemas. */
export class EvidencePostgresqlAdapter extends SqlAdapter {
  /** Uses PostgreSQL identity and DDL rules over the pinned SQL grammar. */
  public constructor() {
    super({
      type: "postgresql",
      scan: (session, source) =>
        new PostgresqlFileScanner(session, source).scan(),
      resolve: PostgresqlOwnership.resolve,
    });
  }
}
