import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/**
 * Represents one physical Dart declaration before library identity reconciliation.
 *
 * The scanner deliberately retains private and part-file declarations here: the
 * library resolver needs their lexical ownership before it can decide which
 * declarations form the selected public surface.
 */
export interface IDartDeclaration {
  /**
   * Identifies this physical extraction record within its source snapshot.
   *
   * This is not a public address: one semantic unit can collect several such
   * records through parts and complementary accessors.
   */
  id: string;

  /** Declared name, or explicit constructor/operator segment. */
  name: string;

  /** Common programming selector. */
  symbol: EvidenceProgrammingSymbol;

  /**
   * Distinguishes declaration forms that share a Dart name.
   *
   * In particular, getter and setter roles must remain separate until unit
   * materialization can merge their complementary public accessors.
   */
  role: string;

  /**
   * Names the defining library after `part` ownership is resolved.
   *
   * Unit identity uses this path so a declaration from a part cannot be
   * mistaken for an independent declaration in the part's physical file.
   */
  library: string;

  /** Lexical semantic ownership segments. */
  identity: string[];

  /** Public file accessor segments. */
  address: string[];

  /** Original declaration and fingerprint ranges. */
  site: IEvidenceUnitSite;

  /** Whether this name and all lexical owners are public. */
  public: boolean;

  /**
   * Identifies the physical lexical owner when this is a member.
   *
   * The adapter maps this record to the owner's published unit only after it
   * knows whether both declarations are public.
   */
  ownerDeclarationId?: string;
}
