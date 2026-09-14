import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { CDeclarationForm } from "./CDeclarationForm";
import type { ICDeclarationAddress } from "./ICDeclarationAddress";

/**
 * Captures one supported C declaration before file-local identity reconciliation.
 *
 * `CFileScanner` creates this record without retaining a Tree-sitter node. The
 * adapter later groups compatible records by `identity`, expands their public
 * addresses, and uses `site` to retain the physical source location that may
 * host a Doxygen annotation.
 */
export interface ICDeclaration {
  /** Stable scanner-local key used by documentation attachments and grouping. */
  id: string;

  /** Source spelling of this declared entity, without its enclosing path. */
  name: string;

  /** Graph symbol category published when the declaration becomes a unit. */
  symbol: EvidenceProgrammingSymbol;

  /** C source form that determines conflict and alias reconciliation rules. */
  form: CDeclarationForm;

  /** Canonical semantic path used to group compatible declarations in one file. */
  identity: string[];

  /** Public spelling candidates, including supported tag and typedef aliases. */
  addresses: ICDeclarationAddress[];

  /** Source position and content span preserved for fingerprinting and hosts. */
  site: IEvidenceUnitSite;

  /** Whether this occurrence supplies a body rather than only a declaration. */
  definition: boolean;

  /** Owning aggregate declaration when this record is a field or enumerator. */
  ownerDeclarationId?: string;

  /** Struct, union, or enum tag when that namespace names this declaration. */
  tagName?: string;
}
