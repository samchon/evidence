import type { IEvidenceDatabaseClaim } from "./IEvidenceDatabaseClaim";
import type { IEvidenceMarkdownClaim } from "./IEvidenceMarkdownClaim";
import type { IEvidenceProgrammingClaim } from "./IEvidenceProgrammingClaim";
import type { IEvidenceSwaggerClaim } from "./IEvidenceSwaggerClaim";

/**
 * Artifact-specific populations that owe Evidence to configured references.
 *
 * The type discriminator chooses extraction and host rules for code, schemas,
 * Markdown, or API operations. Each claim retains its own policy and reference
 * boundaries even when another claim selects the same physical files.
 */
export type IEvidenceClaim =
  | IEvidenceDatabaseClaim
  | IEvidenceMarkdownClaim
  | IEvidenceProgrammingClaim
  | IEvidenceSwaggerClaim;
