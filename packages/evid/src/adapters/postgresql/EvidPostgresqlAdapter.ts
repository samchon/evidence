import { EvidSqlAdapterBase } from "../sql/EvidSqlAdapterBase";
import { EvidPostgresqlFileScanner } from "./EvidPostgresqlFileScanner";
import { EvidPostgresqlOwnership } from "./EvidPostgresqlOwnership";
import { EvidPostgresqlFingerprint } from "./EvidPostgresqlFingerprint";
import type { IEvidInventory } from "../../structures/IEvidInventory";
import type { IEvidSourceSnapshot } from "../../structures/IEvidSourceSnapshot";

/**
 * Extracts PostgreSQL table schemas with cross-file DDL and COMMENT ownership.
 *
 * PostgreSQL scanning and ownership resolution feed the shared SQL inventory
 * materializer. A final fingerprint pass preserves review content semantics when
 * annotation-only COMMENT statements add eligible documentation positions.
 */
export class EvidPostgresqlAdapter extends EvidSqlAdapterBase {
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
        new EvidPostgresqlFileScanner(session, source).scan(),
      resolve: EvidPostgresqlOwnership.resolve,
    });
  }

  /**
   * Applies PostgreSQL COMMENT fingerprint policy after shared inventory extraction.
   *
   * Annotation-only COMMENT additions remain eligible hosts while the fingerprint
   * layer avoids making review metadata invalidate the declaration it reviews.
   */
  public override async analyze(
    snapshot: IEvidSourceSnapshot,
  ): Promise<IEvidInventory> {
    const inventory = await super.analyze(snapshot);
    EvidPostgresqlFingerprint.apply(inventory);
    return inventory;
  }
}
