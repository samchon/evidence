import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { RubyAttributeMode } from "./RubyAttributeMode";
import type { RubyContainerKind } from "./RubyContainerKind";
import type { RubyDeclarationForm } from "./RubyDeclarationForm";
import type { RubyMethodSide } from "./RubyMethodSide";
import type { RubyVisibility } from "./RubyVisibility";

/** One Ruby declaration before reopenings and runtime-name families are reconciled. */
export interface IRubyDeclaration {
  id: string;
  name: string;
  runtimeName: string;
  symbol: EvidenceProgrammingSymbol;
  form: RubyDeclarationForm;
  identity: string[];
  address: string[];
  site: IEvidenceUnitSite;
  visibility: RubyVisibility;
  definition: boolean;
  ownerIdentity?: string[];
  containerKind?: RubyContainerKind;
  side?: RubyMethodSide;
  attributeMode?: RubyAttributeMode;
  superclass?: string;
}
