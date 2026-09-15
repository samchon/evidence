import { EvidenceMysqlFileScanner } from "./EvidenceMysqlFileScanner";
import { EvidenceSqlInventoryMaterializer } from "../sql/EvidenceSqlInventoryMaterializer";
import type { IEvidenceAdapter } from "../../structures/IEvidenceAdapter";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";
import type { IEvidenceSourceSnapshot } from "../../structures/IEvidenceSourceSnapshot";

const Evidence_MYSQL_TYPE = "mysql" as const;

/**
 * Extracts explicitly configured MySQL schema declarations with static
 * ownership.
 *
 * EvidenceMysqlFileScanner supplies MySQL identifier, table, and member records
 * to the common SQL materializer. Schema meaning comes from selected source
 * statements; the adapter neither connects to a server nor executes
 * migrations.
 */
export class EvidenceMysqlAdapter implements IEvidenceAdapter<"mysql"> {
  /**
   * MySQL grammar selected for this adapter.
   *
   * This identity prevents a shared `.sql` extension from changing the
   * declaration surface through dialect probing.
   */
  public get type(): "mysql" {
    return "mysql";
  }

  /**
   * Materializes MySQL scanner records into graph-facing inventory records.
   *
   * The scanner owns MySQL syntax while this collaborator owns parser lifetime
   * and syntax-independent SQL publication.
   */
  private readonly materializer: EvidenceSqlInventoryMaterializer =
    new EvidenceSqlInventoryMaterializer({
      type: Evidence_MYSQL_TYPE,
      scan: EvidenceMysqlFileScanner.scan,
    });

  /**
   * Extracts MySQL declarations from one captured source snapshot.
   *
   * The adapter fixes dialect policy before analysis; parser allocation waits
   * until this method receives a snapshot.
   */
  public analyze(
    snapshot: IEvidenceSourceSnapshot,
  ): Promise<IEvidenceInventory> {
    return this.materializer.analyze(snapshot);
  }
}
