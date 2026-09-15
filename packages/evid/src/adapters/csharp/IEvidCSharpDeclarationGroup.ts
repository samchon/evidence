import type { IEvidCSharpDeclaration } from "./IEvidCSharpDeclaration";

/**
 * Collects physical declarations that resolve to one C# semantic unit.
 *
 * `EvidCSharpAdapterBase` builds these groups while materializing a source
 * snapshot and checks the contained declarations for compatible partial or
 * overload forms. The group bridges scanner-local declaration records and the
 * single published Evid unit, retaining every contributing site and address
 * candidate.
 */
export interface IEvidCSharpDeclarationGroup {
  /**
   * Semantic family key shared by compatible partial and overload declarations.
   *
   * It is used internally before the final unit is emitted.
   */
  id: string;

  /**
   * Physical declarations contributing sites and public address candidates.
   *
   * The adapter rejects incompatible families instead of guessing an owner.
   */
  declarations: IEvidCSharpDeclaration[];
}
