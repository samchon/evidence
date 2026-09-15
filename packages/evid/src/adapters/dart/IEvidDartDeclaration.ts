import type { IEvidUnitSite } from "../../structures/IEvidUnitSite";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";

/**
 * Represents one physical Dart declaration before library identity reconciliation.
 *
 * The scanner deliberately retains private and part-file declarations here: the
 * library resolver needs their lexical ownership before it can decide which
 * declarations form the selected public surface.
 */
export interface IEvidDartDeclaration {
  /**
   * Identifies this physical extraction record within its source snapshot.
   *
   * This is not a public address: one semantic unit can collect several such
   * records through parts and complementary accessors.
   */
  id: string;

  /** Gives the declared name or explicit constructor or operator segment.
   *
   * The scanner combines this with `identity` and `address`; it is unqualified so diagnostics can retain the source spelling.
   */
  name: string;

  /** Classifies the declaration in Evid's language-independent selector vocabulary.
   *
   * Materialization preserves this category while it reconciles declarations with the same Dart name.
   */
  symbol: EvidProgrammingSymbol;

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

  /** Lists the lexical segments that establish the declaration's semantic identity.
   *
   * Library reconciliation prefixes this path with the defining library so parts share their owner's identity.
   */
  identity: string[];

  /** Lists the public accessor segments used in a selected source address.
   *
   * This may differ from `identity` after library exports project a declaration through another file.
   */
  address: string[];

  /** Retains the physical declaration range and content used by hosts and fingerprints.
   *
   * A reconciled unit can collect multiple sites from parts or complementary accessors.
   */
  site: IEvidUnitSite;

  /** States whether this declaration and every lexical owner are publicly visible.
   *
   * The adapter excludes private declarations from publication while retaining them for ownership and boundary diagnostics.
   */
  public: boolean;

  /**
   * Identifies the physical lexical owner when this is a member.
   *
   * The adapter maps this record to the owner's published unit only after it
   * knows whether both declarations are public.
   */
  ownerDeclarationId?: string;
}
