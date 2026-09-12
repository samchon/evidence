import type { IEvidenceUnitSite } from "../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../typings/EvidenceProgrammingSymbol";
import type { CppDeclarationForm } from "./CppDeclarationForm";
import type { CppVisibility } from "./CppVisibility";

/** One C++ declaration before overload and definition families are materialized. */
export interface ICppDeclaration {
  id: string;
  name: string;
  symbol: EvidenceProgrammingSymbol;
  form: CppDeclarationForm;
  identity: string[];
  addresses: string[][];
  site: IEvidenceUnitSite;
  visibility: CppVisibility;
  definition: boolean;
  parentIdentity?: string[];
}
