import { BigQueryFileScanner } from "./BigQueryFileScanner";
import { SqlAdapter } from "../sql/SqlAdapter";

/**
 * Extracts declared GoogleSQL tables, fields, and key relations for BigQuery populations.
 *
 * The BigQuery scanner applies GoogleSQL qualification and declaration rules before
 * shared SQL materialization creates public units and annotation hosts. Analysis
 * operates on source snapshots without querying a service or executing SQL.
 */
export class EvidenceBigQueryAdapter extends SqlAdapter {
  /**
   * Selects the GoogleSQL grammar and BigQuery declaration scanner.
   *
   * The configured dialect controls interpretation even when input shares the .sql
   * suffix with other database families.
   */
  public constructor() {
    super({
      type: "bigquery",
      scan: (session, source) =>
        new BigQueryFileScanner(session, source).scan(),
    });
  }
}
