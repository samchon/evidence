import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { CppAliasKind } from "./CppAliasKind";

/** One statically resolved C++ namespace alias or using declaration. */
export interface ICppAlias {
  id: string;
  kind: CppAliasKind;
  name: string;
  scopeIdentity: string[];
  scopeAddress: string[];
  target: string[];
  site: IEvidenceUnitSite;
  public: boolean;
}
