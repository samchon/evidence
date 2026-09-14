import { EvidenceInventory } from "./EvidenceInventory";
import { EvidenceFingerprintIndex } from "../internal/EvidenceFingerprintIndex";
import type { IEvidenceFingerprint } from "../structures/IEvidenceFingerprint";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";

/** Computes review fingerprints from semantic content rather than source cache keys. */
export namespace EvidenceFingerprint {
  /** Inspects one identity's own digest and versioned structural-scope fingerprint. */
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
