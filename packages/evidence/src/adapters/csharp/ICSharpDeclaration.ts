import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { CSharpAccessibility } from "./CSharpAccessibility";
import type { CSharpDeclarationForm } from "./CSharpDeclarationForm";
import type { ICSharpDeclarationAddress } from "./ICSharpDeclarationAddress";

/** One C# declaration before partial and overload families are materialized. */
export interface ICSharpDeclaration {
  id: string;
  name: string;
  symbol: EvidenceProgrammingSymbol;
  form: CSharpDeclarationForm;
  identity: string[];
  addresses: ICSharpDeclarationAddress[];
  site: IEvidenceUnitSite;
  accessibility: CSharpAccessibility;
  implicitPublic: boolean;
  partial: boolean;
  explicitInterface: boolean;
  ownerDeclarationId?: string;
}
