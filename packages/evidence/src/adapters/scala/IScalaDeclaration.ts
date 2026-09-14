import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/** A source declaration before snapshot-wide overload reconciliation. */
export interface IScalaDeclaration {
  /** Stable extraction record identity. */
  id: string;
  /** Literal Scala source name. */
  name: string;
  /** Public programming selector. */
  symbol: EvidenceProgrammingSymbol;
  /** Package and lexical owner identity. */
  identity: string[];
  /** File-qualified public address. */
  address: string[];
  /** Source names for bounded selected-object export lookup. */
  lookup: string[];
  /** Original declaration and fingerprint ranges. */
  site: IEvidenceUnitSite;
  /** Whether the declaration and its owners have unrestricted visibility. */
  public: boolean;
  /** Whether this declaration is a singleton object usable by a bounded export. */
  object: boolean;
  /** Source node spelling used for semantic boundary checks. */
  syntax: string;
  /** Explicit lexical parent declaration. */
  ownerDeclarationId?: string;
}
