import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { ObjcDeclarationForm } from "./ObjcDeclarationForm";

/** One Objc declaration before overload families and public units are materialized. */
export interface IObjcDeclaration {
  id: string;
  name: string;
  symbol: EvidenceProgrammingSymbol;
  form: ObjcDeclarationForm;
  identity: string[];
  address: string[];
  site: IEvidenceUnitSite;
  public: boolean;
  ownerDeclarationId?: string;
}
