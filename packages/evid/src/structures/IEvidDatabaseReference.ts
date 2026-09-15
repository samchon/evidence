import type { EvidDatabaseSymbol } from "../typings/EvidDatabaseSymbol";
import type { EvidDatabaseType } from "../typings/EvidDatabaseType";
import type { IEvidReferenceBase } from "./IEvidReferenceBase";

/**
 * Database schema units required by the owning claim's reference policy.
 *
 * Model, column, and relation selectors choose the coverage denominator after
 * schema extraction. Parent scopes remain available to resolve aggregate
 * targets, while each reference entry evaluates its selected schema
 * independently.
 */
export interface IEvidDatabaseReference extends IEvidReferenceBase<
  EvidDatabaseType,
  EvidDatabaseSymbol
> {
  /**
   * Schema-file globs relative to the reference root.
   *
   * These use claim glob rules. Prisma files form one schema regardless of
   * extension; repeated physical files are parsed once. Parsing failures must
   * not produce empty populations.
   */
  files: string[];
}
