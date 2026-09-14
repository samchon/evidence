import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/**
 * Represents one static Lua declaration or public alias before inventory reconciliation.
 *
 * Lua exports emerge from initialization values rather than declarations, so
 * identity and reachable address remain separate until table ownership is known.
 */
export interface ILuaDeclaration {
  /**
   * Identifies the extracted value shared by aliases of that static value.
   *
   * This prevents several assignments or returned table paths from becoming
   * several coverage units for one semantic declaration.
   */
  id: string;

  /** Gives the canonical name selected for this public declaration.
   *
   * The adapter retains this source-derived spelling for unit naming and diagnostics while `address` carries its complete path.
   */
  name: string;

  /** Classifies callable values as functions and tables or scalar fields as properties.
   *
   * This Evidence selector is assigned from static value shape without executing the Lua module.
   */
  symbol: EvidenceProgrammingSymbol;

  /** Lists the file-local path that establishes this declaration's semantic identity.
   *
   * Alias projections share the identity of their original static value even when they publish another address.
   */
  identity: string[];

  /** Lists the public path through which this occurrence projects the value.
   *
   * This can differ from `identity` when a local alias or returned table field exposes the same value.
   */
  address: string[];

  /** Retains the physical source site and content used for Evidence hosts and fingerprints.
   *
   * Multiple alias projections can retain separate sites while materializing one semantic unit.
   */
  site: IEvidenceUnitSite;

  /** States whether static initialization makes the value reachable through the public surface.
   *
   * The adapter keeps unreachable values for ownership analysis but excludes them from published units and addresses.
   */
  public: boolean;

  /**
   * Identifies the containing table declaration for a nested field.
   *
   * Parent withdrawal and visibility propagation follow this value instead of
   * reconstructing ownership from a mutable Lua table path.
   */
  ownerDeclarationId?: string;
}
