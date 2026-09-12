import type { IEvidenceUnitSite } from "../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../typings/EvidenceProgrammingSymbol";
import type { JavaDeclarationForm } from "./JavaDeclarationForm";

/** One Java declaration before overload families and public units are materialized. */
export interface IJavaDeclaration {
  id: string;
  name: string;
  symbol: EvidenceProgrammingSymbol;
  form: JavaDeclarationForm;
  identity: string[];
  address: string[];
  site: IEvidenceUnitSite;
  public: boolean;
  ownerDeclarationId?: string;
}
