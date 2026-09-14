import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/** One static Lua declaration or public alias before inventory reconciliation. */
export interface ILuaDeclaration {
  /** Extraction identity shared by aliases of the same value. */
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

  /** Canonical table owner, when nested. */
  ownerDeclarationId?: string;
}
