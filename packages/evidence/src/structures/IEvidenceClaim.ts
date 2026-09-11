import type { IEvidenceDatabaseClaim } from "./IEvidenceDatabaseClaim";
import type { IEvidenceMarkdownClaim } from "./IEvidenceMarkdownClaim";
import type { IEvidenceProgrammingClaim } from "./IEvidenceProgrammingClaim";

/** Artifact populations that must cite their referenced evidence. */
export type IEvidenceClaim =
  IEvidenceDatabaseClaim | IEvidenceMarkdownClaim | IEvidenceProgrammingClaim;
