import type { IEvidenceSourceRange } from "./IEvidenceSourceRange";

/** A physical documentation position, distinct from the identities that own it. */
export interface IEvidenceHost {
  id: string;
  file: string;
  range: IEvidenceSourceRange;
  /** Source paths for relative citations; omitted means file. Merging preserves every origin. */
  origins?: string[];
  /** Declaration site for a semantic host; absent on exclusion-only carriers. */
  siteId?: string;
  unitIds: string[];
  /** Attached carriers may have no unit IDs when the artifact permits only exclusions. */
  attachment: "attached" | "unattached" | "unsupported";
  /** Explanation for an unsupported documentation position, supplied by its adapter. */
  problem?: string;
}
