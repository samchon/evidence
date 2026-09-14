import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/** One PHP declaration before public units are materialized. */
export interface IPhpDeclaration {
  /** Stable extraction identity. */
  id: string;

  /** Exact source name. */
  name: string;

  /** Public selector category. */
  symbol: EvidenceProgrammingSymbol;

  /** Original declaration syntax form. */
  form: string;

  /** Namespace and lexical owner segments. */
  identity: string[];

  /** Exact file-qualified accessor segments. */
  address: string[];

  /** Original declaration site and semantic content. */
  site: IEvidenceUnitSite;

  /** Whether source visibility exposes this declaration. */
  public: boolean;

  /** Lexical type owner when present. */
  ownerDeclarationId?: string;
}
