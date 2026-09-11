import type { IEvidenceSourceRange } from "./IEvidenceSourceRange";

/** A physical documentation position, distinct from the identities that own it. */
export interface IEvidenceHost {
  id: string;
  file: string;
  range: IEvidenceSourceRange;
  /** Source paths for relative citations; omitted means file. Merging preserves every origin. */
  origins?: string[];
  /** An attached host names a declaration site owned by every listed unit. */
  siteId?: string;
  unitIds: string[];
  attachment: "attached" | "unattached" | "unsupported";
  /** Explanation for an unsupported documentation position, supplied by its adapter. */
  problem?: string;
}
