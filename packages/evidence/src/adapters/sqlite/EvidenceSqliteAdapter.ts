import { EvidenceSqlInventoryMaterializer } from "../sql/EvidenceSqlInventoryMaterializer";
import { EvidenceSqliteFileScanner } from "./EvidenceSqliteFileScanner";
import type { IEvidenceAdapter } from "../../structures/IEvidenceAdapter";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";
import type { IEvidenceSourceSnapshot } from "../../structures/IEvidenceSourceSnapshot";

const Evidence_SQLITE_TYPE = "sqlite" as const;

/**
 * Extracts SQLite's explicitly declared tables, columns, and foreign keys.
 *
 * SQLiteFileScanner supplies dialect-specific ownership and identifier rules to
 * the shared SQL materializer. Analysis uses captured DDL source and does not
 * open a database or infer schema by executing statements.
 */
export class EvidenceSqliteAdapter implements IEvidenceAdapter<"sqlite"> {
  /**
   * SQLite grammar selected for this adapter.
   *
   * The explicit dialect keeps SQLite's ownership and identifier rules stable
   * for source files with a shared `.sql` extension.
   */
  public get type(): "sqlite" {
    return "sqlite";
  }

  /**
   * Materializes SQLite scanner records into graph-facing inventory records.
   *
   * SQLite syntax stays with the scanner; this collaborator owns only parser
   * lifetime and syntax-independent SQL record publication.
   */
  private readonly materializer: EvidenceSqlInventoryMaterializer =
    new EvidenceSqlInventoryMaterializer({
      type: Evidence_SQLITE_TYPE,
      scan: (session, source) =>
        new EvidenceSqliteFileScanner(session, source).scan(),
    });

  /**
   * Extracts SQLite declarations from one captured source snapshot.
   *
   * Parser allocation and source analysis wait until this method receives the
   * snapshot.
   */
  public analyze(snapshot: IEvidenceSourceSnapshot): Promise<IEvidenceInventory> {
    return this.materializer.analyze(snapshot);
  }
}
