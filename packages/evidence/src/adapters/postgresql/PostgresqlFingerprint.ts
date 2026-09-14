import { EvidenceFingerprint } from "../../graph/EvidenceFingerprint";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";

/** Keeps PostgreSQL COMMENT metadata out of declaration content fingerprints. */
export namespace PostgresqlFingerprint {
  /** Retains documentation sites for ownership while deriving content from DDL sites alone. */
  export function apply(inventory: IEvidenceInventory): void {
    const semantic = structuredClone(inventory);
    for (const unit of semantic.units)
      unit.sites = unit.sites.filter((site) => !site.id.endsWith(":comment"));
    for (const unit of inventory.units)
      if (unit.sites.some((site) => site.id.endsWith(":comment")))
        unit.contentDigest = EvidenceFingerprint.inspect(
          semantic,
          unit.id,
        ).contentDigest;
  }
}
