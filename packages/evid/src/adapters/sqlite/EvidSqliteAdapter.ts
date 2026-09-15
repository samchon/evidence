import { EvidSqlInventoryMaterializer } from "../sql/EvidSqlInventoryMaterializer";
import { EvidSqliteFileScanner } from "./EvidSqliteFileScanner";
import type { IEvidAdapter } from "../../structures/IEvidAdapter";
import type { IEvidInventory } from "../../structures/IEvidInventory";
import type { IEvidSourceSnapshot } from "../../structures/IEvidSourceSnapshot";

const EVID_SQLITE_TYPE = "sqlite" as const;

/**
 * Extracts SQLite's explicitly declared tables, columns, and foreign keys.
 *
 * SQLiteFileScanner supplies dialect-specific ownership and identifier rules to
 * the shared SQL materializer. Analysis uses captured DDL source and does not
 * open a database or infer schema by executing statements.
 */
export class EvidSqliteAdapter implements IEvidAdapter {
  /**
   * SQLite grammar selected for this adapter.
   *
   * The explicit dialect keeps SQLite's ownership and identifier rules stable
   * for source files with a shared `.sql` extension.
   */
  public readonly type = EVID_SQLITE_TYPE;

  /**
   * Materializes SQLite scanner records into graph-facing inventory records.
   *
   * SQLite syntax stays with the scanner; this collaborator owns only parser
   * lifetime and syntax-independent SQL record publication.
   */
  private readonly materializer: EvidSqlInventoryMaterializer =
    new EvidSqlInventoryMaterializer({
      type: EVID_SQLITE_TYPE,
      scan: (session, source) =>
        new EvidSqliteFileScanner(session, source).scan(),
    });

  /**
   * Extracts SQLite declarations from one captured source snapshot.
   *
   * Parser allocation and source analysis wait until this method receives the
   * snapshot.
   */
  public analyze(snapshot: IEvidSourceSnapshot): Promise<IEvidInventory> {
    return this.materializer.analyze(snapshot);
  }
}
