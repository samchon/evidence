import { EvidenceFingerprintIndex } from "../../internal/EvidenceFingerprintIndex";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";

/**
 * Keeps PostgreSQL COMMENT metadata out of declaration content fingerprints.
 *
 * COMMENT sites remain materialized for annotation ownership, while schema
 * content review must remain stable when only its review metadata changes.
 */
export namespace EvidencePostgresqlFingerprint {
  /**
   * Recomputes affected content digests from DDL sites alone.
   *
   * The cloned inventory removes only COMMENT sites before indexing, preserving
   * all declaration relationships used to derive the original fingerprint.
   */
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
