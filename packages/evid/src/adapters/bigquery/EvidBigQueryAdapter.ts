import { EvidBigQueryFileScanner } from "./EvidBigQueryFileScanner";
import { EvidSqlInventoryMaterializer } from "../sql/EvidSqlInventoryMaterializer";
import type { IEvidAdapter } from "../../structures/IEvidAdapter";
import type { IEvidInventory } from "../../structures/IEvidInventory";
import type { IEvidSourceSnapshot } from "../../structures/IEvidSourceSnapshot";

const EVID_BIGQUERY_TYPE = "bigquery" as const;

/**
 * Extracts declared GoogleSQL tables, fields, and key relations for BigQuery
 * populations.
 *
 * The BigQuery scanner applies GoogleSQL qualification and declaration rules
 * before shared SQL materialization creates public units and annotation hosts.
 * Analysis operates on source snapshots without querying a service or executing
 * SQL.
 */
export class EvidBigQueryAdapter implements IEvidAdapter {
  /**
   * GoogleSQL grammar selected for this adapter.
   *
   * The explicit discriminator preserves BigQuery's declaration semantics for
   * files that otherwise share the `.sql` extension with other dialects.
   */
  public readonly type = EVID_BIGQUERY_TYPE;

  /**
   * Materializes BigQuery scanner records into graph-facing inventory records.
   *
   * BigQuery-specific parsing remains in its scanner; this collaborator owns
   * only parser lifetime and syntax-independent SQL publication.
   */
  private readonly materializer: EvidSqlInventoryMaterializer =
    new EvidSqlInventoryMaterializer({
      type: EVID_BIGQUERY_TYPE,
      scan: (session, source) =>
        new EvidBigQueryFileScanner(session, source).scan(),
    });

  /**
   * Extracts BigQuery declarations from one captured source snapshot.
   *
   * The configured grammar controls interpretation even when input shares the
   * `.sql` suffix with other database families.
   */
  public analyze(snapshot: IEvidSourceSnapshot): Promise<IEvidInventory> {
    return this.materializer.analyze(snapshot);
  }
}
