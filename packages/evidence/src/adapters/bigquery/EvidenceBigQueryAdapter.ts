import { EvidenceBigQueryFileScanner } from "./EvidenceBigQueryFileScanner";
import { EvidenceSqlInventoryMaterializer } from "../sql/EvidenceSqlInventoryMaterializer";
import type { IEvidenceAdapter } from "../../structures/IEvidenceAdapter";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";
import type { IEvidenceSourceSnapshot } from "../../structures/IEvidenceSourceSnapshot";

const Evidence_BIGQUERY_TYPE = "bigquery" as const;

/**
 * Extracts declared GoogleSQL tables, fields, and key relations for BigQuery
 * populations.
 *
 * The BigQuery scanner applies GoogleSQL qualification and declaration rules
 * before shared SQL materialization creates public units and annotation hosts.
 * Analysis operates on source snapshots without querying a service or executing
 * SQL.
 */
export class EvidenceBigQueryAdapter implements IEvidenceAdapter<"bigquery"> {
  /**
   * GoogleSQL grammar selected for this adapter.
   *
   * The explicit discriminator preserves BigQuery's declaration semantics for
   * files that otherwise share the `.sql` extension with other dialects.
   */
  public get type(): "bigquery" {
    return Evidence_BIGQUERY_TYPE;
  }

  /**
   * Materializes BigQuery scanner records into graph-facing inventory records.
   *
   * BigQuery-specific parsing remains in its scanner; this collaborator owns
   * only parser lifetime and syntax-independent SQL publication.
   */
  private readonly materializer: EvidenceSqlInventoryMaterializer =
    new EvidenceSqlInventoryMaterializer({
      type: Evidence_BIGQUERY_TYPE,
      scan: (session, source) =>
        new EvidenceBigQueryFileScanner(session, source).scan(),
    });

  /**
   * Extracts BigQuery declarations from one captured source snapshot.
   *
   * The configured grammar controls interpretation even when input shares the
   * `.sql` suffix with other database families.
   */
  public analyze(snapshot: IEvidenceSourceSnapshot): Promise<IEvidenceInventory> {
    return this.materializer.analyze(snapshot);
  }
}
