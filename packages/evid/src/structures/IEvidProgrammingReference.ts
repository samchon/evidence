import type { EvidProgrammingSymbol } from "../typings/EvidProgrammingSymbol";
import type { EvidProgrammingType } from "../typings/EvidProgrammingType";
import type { IEvidReferenceBase } from "./IEvidReferenceBase";

/**
 * Public programming declarations required by an independent reference
 * obligation.
 *
 * The configured language selects the adapter, and symbol selection determines
 * which extracted identities enter the denominator. Structural ancestors remain
 * resolvable for aggregate citations without becoming extra selected units.
 */
export interface IEvidProgrammingReference extends IEvidReferenceBase<
  EvidProgrammingType,
  EvidProgrammingSymbol
> {
  /**
   * Source-file globs relative to the reference root.
   *
   * These use claim glob rules. Files are read from disk without requiring
   * TypeScript Program membership or package-entry resolution. The type selects
   * the language; file names identify variants such as TSX.
   */
  files: string[];
}
