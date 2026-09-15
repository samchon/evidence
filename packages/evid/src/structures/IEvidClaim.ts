import type { IEvidDatabaseClaim } from "./IEvidDatabaseClaim";
import type { IEvidMarkdownClaim } from "./IEvidMarkdownClaim";
import type { IEvidProgrammingClaim } from "./IEvidProgrammingClaim";
import type { IEvidSwaggerClaim } from "./IEvidSwaggerClaim";

/**
 * Artifact-specific populations that owe evidence to configured references.
 *
 * The type discriminator chooses extraction and host rules for code, schemas,
 * Markdown, or API operations. Each claim retains its own policy and reference
 * boundaries even when another claim selects the same physical files.
 */
export type IEvidClaim =
  | IEvidDatabaseClaim
  | IEvidMarkdownClaim
  | IEvidProgrammingClaim
  | IEvidSwaggerClaim;
