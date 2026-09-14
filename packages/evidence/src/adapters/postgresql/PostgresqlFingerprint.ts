import { EvidenceFingerprintIndex } from "../../internal/EvidenceFingerprintIndex";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";

/** Keeps PostgreSQL COMMENT metadata out of declaration content fingerprints. */
export namespace PostgresqlFingerprint {
  /** Retains documentation sites for ownership while deriving content from DDL sites alone. */
  export function apply(inventory: IEvidenceInventory): void {
    if (!inventory.complete) return;
    const semantic = structuredClone(inventory);
    for (const unit of semantic.units)
      unit.sites = unit.sites.filter((site) => !site.id.endsWith(":comment"));
    const fingerprints = new EvidenceFingerprintIndex(semantic);
    for (const unit of inventory.units)
      if (unit.sites.some((site) => site.id.endsWith(":comment")))
        unit.contentDigest = fingerprints.inspect(unit.id).contentDigest;
  }
}
