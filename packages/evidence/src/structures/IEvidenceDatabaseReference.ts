import type { EvidenceDatabaseSymbol } from "../typings/EvidenceDatabaseSymbol";
import type { EvidenceDatabaseType } from "../typings/EvidenceDatabaseType";
import type { IEvidenceReferenceBase } from "./IEvidenceReferenceBase";

/** Database models, columns, and relations that the owning claim must cite. */
export interface IEvidenceDatabaseReference extends IEvidenceReferenceBase<
  EvidenceDatabaseType,
  EvidenceDatabaseSymbol
> {
  /**
   * Schema-file globs relative to root, using claim glob rules. Prisma files form
   * one schema regardless of extension; repeated physical files are parsed once.
   * Parsing failures must not produce empty populations.
   */
  files: string[];
}
