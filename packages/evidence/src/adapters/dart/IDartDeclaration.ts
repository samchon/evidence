import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/** One physical Dart declaration before library identity reconciliation. */
export interface IDartDeclaration {
  /** Stable extraction identity. */
  id: string;

  /** Declared name, or explicit constructor/operator segment. */
  name: string;

  /** Common programming selector. */
  symbol: EvidenceProgrammingSymbol;

  /** Getter and setter roles permit complementary declaration merging. */
  role: string;

  /** Canonical defining library physical path. */
  library: string;

  /** Lexical semantic ownership segments. */
  identity: string[];

  /** Public file accessor segments. */
  address: string[];

  /** Original declaration and fingerprint ranges. */
  site: IEvidenceUnitSite;

  /** Whether this name and all lexical owners are public. */
  public: boolean;

  /** Explicit containing declaration identity. */
  ownerDeclarationId?: string;
}
