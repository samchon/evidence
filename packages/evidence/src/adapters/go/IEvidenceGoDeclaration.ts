import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { EvidenceGoDeclarationForm } from "./EvidenceGoDeclarationForm";

/**
 * Records one exported Go declaration before package-wide ownership is
 * resolved.
 *
 * EvidenceGoFileScanner creates these physical records, and EvidenceGoPackageResolver
 * combines compatible records into the semantic units that evidence publishes.
 */
export interface IEvidenceGoDeclaration {
  /**
   * Scanner-local identifier used to attach documentation before
   * reconciliation.
   *
   * The resolver replaces this physical key with a package-wide unit ID.
   */
  id: string;

  /**
   * Unqualified exported name displayed by the resulting Evidence unit.
   *
   * A member's owner, when present, supplies the preceding identity segment.
   */
  name: string;

  /**
   * Common graph category assigned to the declaration's Go symbol.
   *
   * This lets downstream selection use the language-independent symbol model.
   */
  symbol: EvidenceProgrammingSymbol;

  /**
   * Go syntax form used to resolve receivers and compatible declarations.
   *
   * Package materialization accepts only local defined types as method
   * receivers.
   */
  form: EvidenceGoDeclarationForm;

  /**
   * Exported enclosing type name for a member or receiver method.
   *
   * Omission means that the declaration belongs directly to the package
   * surface.
   */
  owner?: string;

  /**
   * Physical declaration-site identifier used when attaching Evidence hosts.
   *
   * It remains distinct even when several sites materialize one semantic unit.
   */
  positionSiteId: string;

  /**
   * Physical source spans that contribute this declaration's Evidence content.
   *
   * The resolver preserves every compatible site in the published unit.
   */
  sites: IEvidenceUnitSite[];
}
