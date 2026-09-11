import type { IEvidenceDatabaseReference } from "./IEvidenceDatabaseReference";
import type { IEvidenceMarkdownReference } from "./IEvidenceMarkdownReference";
import type { IEvidenceProgrammingReference } from "./IEvidenceProgrammingReference";
import type { IEvidenceSwaggerReference } from "./IEvidenceSwaggerReference";

/** Evidence populations that a claim must cover independently. */
export type IEvidenceReference =
  | IEvidenceDatabaseReference
  | IEvidenceMarkdownReference
  | IEvidenceProgrammingReference
  | IEvidenceSwaggerReference;
