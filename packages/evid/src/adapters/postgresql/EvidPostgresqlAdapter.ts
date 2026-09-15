import { EvidSqlInventoryMaterializer } from "../sql/EvidSqlInventoryMaterializer";
import { EvidPostgresqlFileScanner } from "./EvidPostgresqlFileScanner";
import { EvidPostgresqlOwnership } from "./EvidPostgresqlOwnership";
import { EvidPostgresqlFingerprint } from "./EvidPostgresqlFingerprint";
import type { IEvidAdapter } from "../../structures/IEvidAdapter";
import type { IEvidInventory } from "../../structures/IEvidInventory";
import type { IEvidSourceSnapshot } from "../../structures/IEvidSourceSnapshot";

const EVID_POSTGRESQL_TYPE = "postgresql" as const;

/**
 * Extracts PostgreSQL table schemas with cross-file DDL and COMMENT ownership.
 *
 * PostgreSQL scanning and ownership resolution feed the shared SQL inventory
 * materializer. A final fingerprint pass preserves review content semantics
 * when annotation-only COMMENT statements add eligible documentation
 * positions.
 */
export class EvidPostgresqlAdapter implements IEvidAdapter<"postgresql"> {
  /**
   * PostgreSQL grammar selected for this adapter.
   *
   * The explicit dialect keeps PostgreSQL DDL and COMMENT semantics stable for
   * source files that share the `.sql` extension with other databases.
   */
  public get type(): "postgresql" {
    return "postgresql";
  }

  /**
   * Materializes PostgreSQL scanner records before fingerprint adjustment.
   *
   * PostgreSQL scanning and ownership stay owned by this adapter's policy;
   * shared parser lifetime and syntax-independent publication stay separate.
   */
  private readonly materializer: EvidSqlInventoryMaterializer =
    new EvidSqlInventoryMaterializer({
      type: EVID_POSTGRESQL_TYPE,
      scan: (session, source) =>
        new EvidPostgresqlFileScanner(session, source).scan(),
      resolve: EvidPostgresqlOwnership.resolve,
    });

  /**
   * Extracts PostgreSQL declarations and applies COMMENT fingerprint policy.
   *
   * Annotation-only COMMENT additions remain eligible hosts while the
   * fingerprint layer avoids making review metadata invalidate the declaration
   * it reviews.
   */
  public async analyze(snapshot: IEvidSourceSnapshot): Promise<IEvidInventory> {
    const inventory: IEvidInventory = await this.materializer.analyze(snapshot);
    EvidPostgresqlFingerprint.apply(inventory);
    return inventory;
  }
}
