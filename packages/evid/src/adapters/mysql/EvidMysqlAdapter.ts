import { EvidMysqlFileScanner } from "./EvidMysqlFileScanner";
import { EvidSqlInventoryMaterializer } from "../sql/EvidSqlInventoryMaterializer";
import type { IEvidAdapter } from "../../structures/IEvidAdapter";
import type { IEvidInventory } from "../../structures/IEvidInventory";
import type { IEvidSourceSnapshot } from "../../structures/IEvidSourceSnapshot";

const EVID_MYSQL_TYPE = "mysql" as const;

/**
 * Extracts explicitly configured MySQL schema declarations with static
 * ownership.
 *
 * EvidMysqlFileScanner supplies MySQL identifier, table, and member records to
 * the common SQL materializer. Schema meaning comes from selected source
 * statements; the adapter neither connects to a server nor executes
 * migrations.
 */
export class EvidMysqlAdapter implements IEvidAdapter<"mysql"> {
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
  private readonly materializer: EvidSqlInventoryMaterializer =
    new EvidSqlInventoryMaterializer({
      type: EVID_MYSQL_TYPE,
      scan: EvidMysqlFileScanner.scan,
    });

  /**
   * Extracts MySQL declarations from one captured source snapshot.
   *
   * The adapter fixes dialect policy before analysis; parser allocation waits
   * until this method receives a snapshot.
   */
  public analyze(snapshot: IEvidSourceSnapshot): Promise<IEvidInventory> {
    return this.materializer.analyze(snapshot);
  }
}
