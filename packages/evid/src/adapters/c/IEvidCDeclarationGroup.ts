import type { IEvidCDeclaration } from "./IEvidCDeclaration";

/**
 * Collects C declarations that claim one file-local semantic identity.
 *
 * The C adapter deliberately limits this group to one physical source file:
 * equal names in separate translation units do not prove C linkage equivalence.
 * Materialization uses the members to detect incompatible forms and duplicate
 * definitions before it publishes a single Evid unit.
 */
export interface IEvidCDeclarationGroup {
  /**
   * File-qualified identifier shared by every member of the group.
   *
   * The adapter uses it as the materialized unit ID within this physical source boundary.
   */
  id: string;

  /**
   * Declarations whose forms and definitions must be mutually compatible.
   *
   * Their sites and addresses become the selected unit only after validation succeeds.
   */
  declarations: IEvidCDeclaration[];
}
