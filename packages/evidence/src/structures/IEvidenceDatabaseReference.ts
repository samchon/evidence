import type { EvidenceDatabaseSymbol } from "../typings/EvidenceDatabaseSymbol";
import type { EvidenceDatabaseType } from "../typings/EvidenceDatabaseType";
import type { IEvidenceReferenceBase } from "./IEvidenceReferenceBase";

/** Database models, columns, and relations that the owning claim must cite. */
export interface IEvidenceDatabaseReference extends IEvidenceReferenceBase<EvidenceDatabaseType> {
  /**
   * Required schema-file globs relative to root, using the ordered include and
   * exclude rules of claim file globs. Prisma files form one
   * schema regardless of extension; repeated physical files are parsed once.
   * Parsing failures must not become empty populations.
   */
  files: string[];

  /**
   * Selected declaration kinds; accepts one kind or a nonempty array.
   * Unselected models remain addressable as aggregate targets.
   *
   * @default model
   */
  symbol?: EvidenceDatabaseSymbol | EvidenceDatabaseSymbol[];
}
