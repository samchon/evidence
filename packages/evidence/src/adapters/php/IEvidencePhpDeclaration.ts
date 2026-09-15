import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/**
 * Captures one PHP declaration before public inventory materialization.
 *
 * EvidencePhpAdapter groups these lexical records into semantic units, retaining
 * exact source spelling for public addresses while separately normalizing
 * identity.
 */
export interface IEvidencePhpDeclaration {
  /**
   * Stable scanner identity for this declaration occurrence.
   *
   * Documentation attachments and owner links use it before public units exist.
   */
  id: string;

  /**
   * Declaration name exactly as PHP source spells it.
   *
   * Property names retain `$`, which is meaningful to public target
   * construction.
   */
  name: string;

  /**
   * Evidence selector family assigned to this declaration.
   *
   * Consumers use it to distinguish nominal types, functions, and properties.
   */
  symbol: EvidenceProgrammingSymbol;

  /**
   * Tree-sitter declaration form that established this record.
   *
   * It lets later validation distinguish source constructs sharing one selector
   * category.
   */
  form: string;

  /**
   * Namespace and lexical-owner segments forming semantic identity.
   *
   * EvidencePhpAdapter applies PHP case rules to this path without changing public
   * spelling.
   */
  identity: string[];

  /**
   * Exact accessor segments published beneath this declaration's source file.
   *
   * Address aliases remain independent of semantic identity and preserve
   * case-sensitive properties.
   */
  address: string[];

  /**
   * Source site and content ranges used for fingerprints and documentation
   * hosts.
   *
   * The scanner can include declaration carriers and separated property
   * elements precisely.
   */
  site: IEvidenceUnitSite;

  /**
   * Whether lexical PHP visibility exposes this declaration on the supported
   * surface.
   *
   * A hidden owner also prevents all of its members from being published.
   */
  public: boolean;

  /**
   * Scanner identity of the enclosing nominal declaration when this is a
   * member.
   *
   * Omission denotes a namespace-level declaration with no inherited visibility
   * boundary.
   */
  ownerDeclarationId?: string;
}
