/** Versioned content identity of one cited semantic scope. */
export interface IEvidenceFingerprint {
  version: number;
  unitId: string;
  contentDigest: string;
  scopeDigest: string;
  fingerprint: string;
}
