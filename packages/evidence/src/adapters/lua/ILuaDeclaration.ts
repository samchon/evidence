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

  /** Canonical public name. */
  name: string;

  /** Functions are callable; tables and literal fields are properties. */
  symbol: EvidenceProgrammingSymbol;

  /** Canonical file-local public path. */
  identity: string[];

  /** Public path for this projection. */
  address: string[];

  /** Original declaration position and semantic content. */
  site: IEvidenceUnitSite;

  /** Whether the value is reachable through the declared public surface. */
  public: boolean;

  /**
   * Identifies the containing table declaration for a nested field.
   *
   * Parent withdrawal and visibility propagation follow this value instead of
   * reconstructing ownership from a mutable Lua table path.
   */
  ownerDeclarationId?: string;
}
