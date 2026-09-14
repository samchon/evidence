import type { IEvidenceDatabaseReference } from "./IEvidenceDatabaseReference";
import type { IEvidenceMarkdownReference } from "./IEvidenceMarkdownReference";
import type { IEvidenceProgrammingReference } from "./IEvidenceProgrammingReference";
import type { IEvidenceSwaggerReference } from "./IEvidenceSwaggerReference";

/**
 * Artifact-specific evidence populations required by an owning claim.
 *
 * Each entry supplies its own selection, target grammar, and effective policy.
 * Repeated entries are independent obligations rather than a union that allows
 * coverage accepted in one reference to satisfy another automatically.
 */
export type IEvidenceReference =
  | IEvidenceDatabaseReference
  | IEvidenceMarkdownReference
  | IEvidenceProgrammingReference
  | IEvidenceSwaggerReference;
