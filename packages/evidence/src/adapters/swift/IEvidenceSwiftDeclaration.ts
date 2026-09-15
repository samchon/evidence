import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/**
 * Represents one explicit Swift declaration before module-wide extension
 * reconciliation.
 *
 * Extensions, aliases, and nominal declarations are recorded separately so the
 * adapter can attach members to their real type without losing their source
 * site.
 */
export interface IEvidenceSwiftDeclaration {
  /**
   * Extraction identity of the physical declaration.
   *
   * Documentation attachments use this scanner-local key before semantic units
   * are materialized.
   */
  id: string;

  /**
   * Literal declaration name, with overloads grouped by base name.
   *
   * The adapter uses identity and symbol to distinguish families beyond this
   * display name.
   */
  name: string;

  /**
   * Common programming selector.
   *
   * It supplies evidence's language-independent category for population selection.
   */
  symbol: EvidenceProgrammingSymbol;

  /**
   * Module-relative semantic ownership segments.
   *
   * Ownership resolution rewrites extension members to the resolved nominal
   * path.
   */
  identity: string[];

  /**
   * File-qualified accessor segments.
   *
   * The adapter publishes these segments with the configured source address.
   */
  address: string[];

  /**
   * Original source site used for fingerprints and attached hosts.
   *
   * Reconciled declarations retain their distinct physical sites in one unit.
   */
  site: IEvidenceUnitSite;

  /**
   * Effective public/open visibility after ownership resolution.
   *
   * A public member still becomes unavailable when an enclosing owner is
   * inaccessible.
   */
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
   * States whether `target` names a type alias rather than its final nominal
   * type.
   *
   * The ownership resolver follows aliases deliberately, avoiding a merge with
   * an unrelated type that happens to share the alias's source spelling.
   */
  alias: boolean;

  /**
   * Declaration kind controlling member visibility defaults.
   *
   * The scanner uses it for protocol and extension behavior without reparsing
   * the node.
   */
  form: string;

  /**
   * Whether nominal lookup is restricted to this physical file.
   *
   * Local aliases and extensions cannot resolve a fileprivate target in another
   * file.
   */
  filePrivate: boolean;

  /**
   * Explicit lexical owner, retained independently of accessor text.
   *
   * Parent traversal uses this key so literal name segments do not imply
   * containment.
   */
  ownerDeclarationId?: string;
}
