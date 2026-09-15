import { EvidInventory } from "./EvidInventory";
import { EvidFingerprintIndex } from "../internal/EvidFingerprintIndex";
import type { IEvidFingerprint } from "../structures/IEvidFingerprint";
import type { IEvidInventory } from "../structures/IEvidInventory";

/**
 * Computes review fingerprints from reconciled semantic content.
 *
 * Review freshness must change when a declaration or its structural scope
 * changes, not when an adapter cache key, scan order, or caller-owned object
 * changes. This namespace first rebuilds the supplied inventory through the
 * normal validation boundary and delegates the versioned digest algorithm to
 * the shared index.
 */
export namespace EvidFingerprint {
  /**
   * Returns one unit's own digest and versioned structural-scope fingerprint.
   *
   * The result includes content accepted for review as well as the explicit
   * parent chain required to detect moves between owners. It rejects incomplete
   * inventory because a missing unit would make a stable-looking fingerprint
   * untrustworthy.
   *
   * @example
   *   const fingerprint: IEvidFingerprint = EvidFingerprint.inspect(
   *     inventory,
   *     unitId,
   *   );
   *   // Persist fingerprint.value with a review of this semantic unit.
   */
  export function inspect(
    inventory: IEvidInventory,
    unitId: string,
  ): IEvidFingerprint {
    const snapshot = new EvidInventory([inventory]).snapshot();
    if (!snapshot.complete)
      throw new Error("Cannot fingerprint an incomplete evidence inventory.");
    return new EvidFingerprintIndex(snapshot).inspect(unitId);
  }
}
