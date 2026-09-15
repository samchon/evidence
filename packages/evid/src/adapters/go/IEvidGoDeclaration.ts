import type { IEvidUnitSite } from "../../structures/IEvidUnitSite";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";
import type { EvidGoDeclarationForm } from "./EvidGoDeclarationForm";

/**
 * Records one exported Go declaration before package-wide ownership is resolved.
 *
 * EvidGoFileScanner creates these physical records, and EvidGoPackageResolver combines
 * compatible records into the semantic units that Evid publishes.
 */
export interface IEvidGoDeclaration {
  /**
   * Scanner-local identifier used to attach documentation before reconciliation.
   *
   * The resolver replaces this physical key with a package-wide unit ID.
   */
  id: string;

  /**
   * Unqualified exported name displayed by the resulting evidence unit.
   *
   * A member's owner, when present, supplies the preceding identity segment.
   */
  name: string;

  /**
   * Common graph category assigned to the declaration's Go symbol.
   *
   * This lets downstream selection use the language-independent symbol model.
   */
  symbol: EvidProgrammingSymbol;

  /**
   * Go syntax form used to resolve receivers and compatible declarations.
   *
   * Package materialization accepts only local defined types as method receivers.
   */
  form: EvidGoDeclarationForm;

  /**
   * Exported enclosing type name for a member or receiver method.
   *
   * Omission means that the declaration belongs directly to the package surface.
   */
  owner?: string;

  /**
   * Physical declaration-site identifier used when attaching evidence hosts.
   *
   * It remains distinct even when several sites materialize one semantic unit.
   */
  positionSiteId: string;

  /**
   * Physical source spans that contribute this declaration's evidence content.
   *
   * The resolver preserves every compatible site in the published unit.
   */
  sites: IEvidUnitSite[];
}
