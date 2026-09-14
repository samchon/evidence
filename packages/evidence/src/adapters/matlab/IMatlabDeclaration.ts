import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/** A MATLAB declaration before class-folder and accessor reconciliation. */
export interface IMatlabDeclaration {
  /** Unique extraction site identity. */
  id: string;
  /** Literal declaration name. */
  name: string;
  /** Common selector. */
  symbol: EvidenceProgrammingSymbol;
  /** Package and lexical owner segments. */
  identity: string[];
  /** Public file accessor segments. */
  address: string[];
  /** Physical file establishing semantic ownership. */
  anchor: string;
  /** Whether the declaration is externally accessible. */
  public: boolean;
  /** Class-folder owner file required by an external method. */
  externalOwner?: string;
  /** A method signature requiring a selected implementation, unless abstract. */
  implementation?: string;
  /** A getter or setter that belongs to an existing property. */
  accessor?: "get" | "set";
  /** Property read access. */
  getPublic?: boolean;
  /** Property write access. */
  setPublic?: boolean;
  /** Additional class-file aliases for an external method. */
  publicFiles?: string[];
  /** Explicit parent extraction identity. */
  ownerDeclarationId?: string;
  /** Original declaration and fingerprint spans. */
  site: IEvidenceUnitSite;
}
