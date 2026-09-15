import { EvidFingerprintIndex } from "../../internal/EvidFingerprintIndex";
import type { IEvidInventory } from "../../structures/IEvidInventory";

/**
 * Keeps PostgreSQL COMMENT metadata out of declaration content fingerprints.
 *
 * COMMENT sites remain materialized for annotation ownership, while schema
 * content review must remain stable when only its review metadata changes.
 */
export namespace EvidPostgresqlFingerprint {
  /**
   * Recomputes affected content digests from DDL sites alone.
   *
   * The cloned inventory removes only COMMENT sites before indexing, preserving
   * all declaration relationships used to derive the original fingerprint.
   */
  export function apply(inventory: IEvidInventory): void {
    if (!inventory.complete) return;
    const semantic = structuredClone(inventory);
    for (const unit of semantic.units)
      unit.sites = unit.sites.filter((site) => !site.id.endsWith(":comment"));
    const fingerprints = new EvidFingerprintIndex(semantic);
    for (const unit of inventory.units)
      if (unit.sites.some((site) => site.id.endsWith(":comment")))
        unit.contentDigest = fingerprints.inspect(unit.id).contentDigest;
  }
}
