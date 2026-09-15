import { EvidenceSqlInventoryMaterializer } from "../sql/EvidenceSqlInventoryMaterializer";
import { EvidencePostgresqlFileScanner } from "./EvidencePostgresqlFileScanner";
import { EvidencePostgresqlOwnership } from "./EvidencePostgresqlOwnership";
import { EvidencePostgresqlFingerprint } from "./EvidencePostgresqlFingerprint";
import type { IEvidenceAdapter } from "../../structures/IEvidenceAdapter";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";
import type { IEvidenceSourceSnapshot } from "../../structures/IEvidenceSourceSnapshot";

const EVID_POSTGRESQL_TYPE = "postgresql" as const;

/**
 * Extracts PostgreSQL table schemas with cross-file DDL and COMMENT ownership.
 *
 * PostgreSQL scanning and ownership resolution feed the shared SQL inventory
 * materializer. A final fingerprint pass preserves review content semantics
 * when annotation-only COMMENT statements add eligible documentation
 * positions.
 */
export class EvidencePostgresqlAdapter implements IEvidenceAdapter<"postgresql"> {
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
  private readonly materializer: EvidenceSqlInventoryMaterializer =
    new EvidenceSqlInventoryMaterializer({
      type: EVID_POSTGRESQL_TYPE,
      scan: (session, source) =>
        new EvidencePostgresqlFileScanner(session, source).scan(),
      resolve: EvidencePostgresqlOwnership.resolve,
    });

  /**
   * Extracts PostgreSQL declarations and applies COMMENT fingerprint policy.
   *
   * Annotation-only COMMENT additions remain eligible hosts while the
   * fingerprint layer avoids making review metadata invalidate the declaration
   * it reviews.
   */
  public async analyze(snapshot: IEvidenceSourceSnapshot): Promise<IEvidenceInventory> {
    const inventory: IEvidenceInventory = await this.materializer.analyze(snapshot);
    EvidencePostgresqlFingerprint.apply(inventory);
    return inventory;
  }
}
