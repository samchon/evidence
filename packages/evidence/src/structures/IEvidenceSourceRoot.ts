/** Declared, logical, and physical spellings of one population root. */
export interface IEvidenceSourceRoot {
  /** Authored root, or "." when omitted. */
  declared: string;

  /** Absolute path before resolving directory links. */
  absolute: string;

  /** Canonical scan root; omitted when glob discovery did not resolve a directory. */
  physical?: string;

  /** Path relative to the configuration directory, or absolute across volumes. */
  display: string;
}
