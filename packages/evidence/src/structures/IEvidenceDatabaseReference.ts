import type { EvidenceDatabaseSymbol } from "../typings/EvidenceDatabaseSymbol";
import type { EvidenceDatabaseType } from "../typings/EvidenceDatabaseType";
import type { IEvidenceReferenceBase } from "./IEvidenceReferenceBase";

/**
 * Database schema units required by the owning claim's reference policy.
 *
 * Model, column, and relation selectors choose the coverage denominator after
 * schema extraction. Parent scopes remain available to resolve aggregate targets,
 * while each reference entry evaluates its selected schema independently.
 */
export interface IEvidenceDatabaseReference extends IEvidenceReferenceBase<
  EvidenceDatabaseType,
  EvidenceDatabaseSymbol
> {
  /**
   * Schema-file globs relative to the reference root.
   *
   * These use claim glob rules. Prisma files form one schema regardless of
   * extension; repeated physical files are parsed once.
   * Parsing failures must not produce empty populations.
   */
  files: string[];
}
