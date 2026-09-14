import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/**
 * Represents one explicit Swift declaration before module-wide extension reconciliation.
 *
 * Extensions, aliases, and nominal declarations are recorded separately so the
 * adapter can attach members to their real type without losing their source site.
 */
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

  /**
   * Marks a record that reopens a nominal type instead of defining one.
   *
   * Extension records contribute their source position and documentation, while
   * their members acquire identity from the resolved nominal target.
   */
  extension: boolean;

  /**
   * Names the statically recognized target of an extension or type alias.
   *
   * Omission preserves an unresolved boundary so the adapter can diagnose it
   * instead of inventing a public owner from textual spelling.
   */
  target?: string[];

  /**
   * States whether `target` names a type alias rather than its final nominal type.
   *
   * The ownership resolver follows aliases deliberately, avoiding a merge with
   * an unrelated type that happens to share the alias's source spelling.
   */
  alias: boolean;

  /** Declaration kind controlling member visibility defaults. */
  form: string;

  /** Whether nominal lookup is restricted to this physical file. */
  filePrivate: boolean;

  /** Explicit lexical owner, retained independently of accessor text. */
  ownerDeclarationId?: string;
}
