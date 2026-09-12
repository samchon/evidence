import type { IEvidenceUnitSite } from "../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../typings/EvidenceProgrammingSymbol";
import type { CDeclarationForm } from "./CDeclarationForm";
import type { ICDeclarationAddress } from "./ICDeclarationAddress";

/** One C declaration before file-local declaration families are materialized. */
export interface ICDeclaration {
  id: string;
  name: string;
  symbol: EvidenceProgrammingSymbol;
  form: CDeclarationForm;
  identity: string[];
  addresses: ICDeclarationAddress[];
  site: IEvidenceUnitSite;
  definition: boolean;
  ownerDeclarationId?: string;
  tagName?: string;
}
