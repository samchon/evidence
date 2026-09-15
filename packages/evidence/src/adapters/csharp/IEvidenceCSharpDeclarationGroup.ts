import type { IEvidenceCSharpDeclaration } from "./IEvidenceCSharpDeclaration";

/**
 * Collects physical declarations that resolve to one C# semantic unit.
 *
 * `EvidenceCSharpAdapter` builds these groups while materializing a source
 * snapshot and checks the contained declarations for compatible partial or
 * overload forms. The group bridges scanner-local declaration records and the
 * single published Evidence unit, retaining every contributing site and address
 * candidate.
 */
export interface IEvidenceCSharpDeclarationGroup {
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
  declarations: IEvidenceCSharpDeclaration[];
}
