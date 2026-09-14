import { SqlAdapter } from "../sql/SqlAdapter";
import { PostgresqlFileScanner } from "./PostgresqlFileScanner";
import { PostgresqlOwnership } from "./PostgresqlOwnership";
import { PostgresqlFingerprint } from "./PostgresqlFingerprint";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";
import type { IEvidenceSourceSnapshot } from "../../structures/IEvidenceSourceSnapshot";

/**
 * Extracts PostgreSQL table schemas with cross-file DDL and COMMENT ownership.
 *
 * PostgreSQL scanning and ownership resolution feed the shared SQL inventory
 * materializer. A final fingerprint pass preserves review content semantics when
 * annotation-only COMMENT statements add eligible documentation positions.
 */
export class EvidencePostgresqlAdapter extends SqlAdapter {
  /**
   * Selects PostgreSQL identity rules, scanning, and ownership resolution.
   *
   * These hooks interpret captured DDL through the pinned SQL grammar without
   * executing statements against a database.
   */
  public constructor() {
    super({
      type: "postgresql",
      scan: (session, source) =>
        new PostgresqlFileScanner(session, source).scan(),
      resolve: PostgresqlOwnership.resolve,
    });
  }

  /**
   * Applies PostgreSQL COMMENT fingerprint policy after shared inventory extraction.
   *
   * Annotation-only COMMENT additions remain eligible hosts while the fingerprint
   * layer avoids making review metadata invalidate the declaration it reviews.
   */
  public override async analyze(
    snapshot: IEvidenceSourceSnapshot,
  ): Promise<IEvidenceInventory> {
    const inventory = await super.analyze(snapshot);
    PostgresqlFingerprint.apply(inventory);
    return inventory;
  }
}
