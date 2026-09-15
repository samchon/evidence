import type { IEvidDatabaseReference } from "./IEvidDatabaseReference";
import type { IEvidMarkdownReference } from "./IEvidMarkdownReference";
import type { IEvidProgrammingReference } from "./IEvidProgrammingReference";
import type { IEvidSwaggerReference } from "./IEvidSwaggerReference";

/**
 * Artifact-specific evidence populations required by an owning claim.
 *
 * Each entry supplies its own selection, target grammar, and effective policy.
 * Repeated entries are independent obligations rather than a union that allows
 * coverage accepted in one reference to satisfy another automatically.
 */
export type IEvidReference =
  | IEvidDatabaseReference
  | IEvidMarkdownReference
  | IEvidProgrammingReference
  | IEvidSwaggerReference;
