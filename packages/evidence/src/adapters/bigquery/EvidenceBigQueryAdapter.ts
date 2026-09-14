import { BigQueryFileScanner } from "./BigQueryFileScanner";
import { SqlAdapter } from "../sql/SqlAdapter";

/** Extracts explicitly declared GoogleSQL tables with their fields and key relations. */
export class EvidenceBigQueryAdapter extends SqlAdapter {
  /** Uses only the configured GoogleSQL grammar and declaration scanner. */
  public constructor() {
    super({
      type: "bigquery",
      scan: (session, source) =>
        new BigQueryFileScanner(session, source).scan(),
    });
  }
}
