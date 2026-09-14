import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { RustDeclarationForm } from "./RustDeclarationForm";
import type { RustVisibility } from "./RustVisibility";

/** One Rust declaration before module reachability and impl ownership are resolved. */
export interface IRustDeclaration {
  id: string;
  modulePath: string[];
  name: string;
  symbol: EvidenceProgrammingSymbol;
  form: RustDeclarationForm;
  visibility: RustVisibility;
  site: IEvidenceUnitSite;
  ownerDeclarationId?: string;
  implementationId?: string;
  memberSegment?: string;
}
