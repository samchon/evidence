import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { GoDeclarationForm } from "./GoDeclarationForm";

/** One exported Go declaration before package-wide receiver ownership is resolved. */
export interface IGoDeclaration {
  id: string;
  name: string;
  symbol: EvidenceProgrammingSymbol;
  form: GoDeclarationForm;
  owner?: string;
  positionSiteId: string;
  sites: IEvidenceUnitSite[];
}
