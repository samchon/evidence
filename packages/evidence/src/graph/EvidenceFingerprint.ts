import { EvidenceInventory } from "./EvidenceInventory";
import { EvidenceFingerprintIndex } from "../internal/EvidenceFingerprintIndex";
import type { IEvidenceFingerprint } from "../structures/IEvidenceFingerprint";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";

/**
 * Computes review fingerprints from reconciled semantic content.
 *
 * Review freshness must change when a declaration or its structural scope
 * changes, not when an adapter cache key, scan order, or caller-owned object
 * changes. This namespace first rebuilds the supplied inventory through the
 * normal validation boundary and delegates the versioned digest algorithm to
 * the shared index.
 */
export namespace EvidenceFingerprint {
  /**
   * Returns one unit's own digest and versioned structural-scope fingerprint.
   *
   * The result includes content accepted for review as well as the explicit
   * parent chain required to detect moves between owners. It rejects incomplete
   * inventory because a missing unit would make a stable-looking fingerprint
   * untrustworthy.
   *
   * @example
   *   const fingerprint: IEvidenceFingerprint = EvidenceFingerprint.inspect(
   *     inventory,
   *     unitId,
   *   );
   *   // Persist fingerprint.value with a review of this semantic unit.
   */
  export function inspect(
    inventory: IEvidenceInventory,
    unitId: string,
  ): IEvidenceFingerprint {
    const snapshot = new EvidenceInventory([inventory]).snapshot();
    if (!snapshot.complete)
      throw new Error("Cannot fingerprint an incomplete evidence inventory.");
    return new EvidenceFingerprintIndex(snapshot).inspect(unitId);
  }
}
