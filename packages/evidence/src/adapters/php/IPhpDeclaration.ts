import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/** One Php declaration before overload families and public units are materialized. */
export interface IPhpDeclaration {
  id: string;
  name: string;
  symbol: EvidenceProgrammingSymbol;
  form: string;
  identity: string[];
  address: string[];
  site: IEvidenceUnitSite;
  public: boolean;
  ownerDeclarationId?: string;
}
