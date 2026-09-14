import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/** One explicit Swift declaration before module-wide extension reconciliation. */
export interface ISwiftDeclaration {
  /** Extraction identity of the physical declaration. */
  id: string;

  /** Literal declaration name, with overloads grouped by base name. */
  name: string;

  /** Common programming selector. */
  symbol: EvidenceProgrammingSymbol;

  /** Module-relative semantic ownership segments. */
  identity: string[];

  /** File-qualified accessor segments. */
  address: string[];

  /** Original source site used for fingerprints and attached hosts. */
  site: IEvidenceUnitSite;

  /** Effective public/open visibility after ownership resolution. */
  public: boolean;

  /** Whether this record is a reopening rather than a nominal declaration. */
  extension: boolean;

  /** Nominal target of an extension or type alias, when statically available. */
  target?: string[];

  /** Whether the nominal target belongs to a type alias. */
  alias: boolean;

  /** Declaration kind controlling member visibility defaults. */
  form: string;

  /** Whether nominal lookup is restricted to this physical file. */
  filePrivate: boolean;

  /** Explicit lexical owner, retained independently of accessor text. */
  ownerDeclarationId?: string;
}
