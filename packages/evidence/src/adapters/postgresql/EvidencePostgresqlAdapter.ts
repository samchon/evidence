import { SqlAdapter } from "../sql/SqlAdapter";
import { PostgresqlFileScanner } from "./PostgresqlFileScanner";
import { PostgresqlOwnership } from "./PostgresqlOwnership";
import { PostgresqlFingerprint } from "./PostgresqlFingerprint";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";
import type { IEvidenceSourceSnapshot } from "../../structures/IEvidenceSourceSnapshot";

/** Extracts explicitly configured PostgreSQL declared table schemas. */
export class EvidencePostgresqlAdapter extends SqlAdapter {
  /** Uses PostgreSQL identity and DDL rules over the pinned SQL grammar. */
  public constructor() {
    super({
      type: "postgresql",
      scan: (session, source) =>
        new PostgresqlFileScanner(session, source).scan(),
      resolve: PostgresqlOwnership.resolve,
    });
  }

  /** Preserves annotation-only COMMENT additions without discarding their eligible host positions. */
  public override async analyze(
    snapshot: IEvidenceSourceSnapshot,
  ): Promise<IEvidenceInventory> {
    const inventory = await super.analyze(snapshot);
    PostgresqlFingerprint.apply(inventory);
    return inventory;
  }
}
