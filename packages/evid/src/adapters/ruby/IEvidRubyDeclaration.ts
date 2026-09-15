import type { IEvidUnitSite } from "../../structures/IEvidUnitSite";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";
import type { EvidRubyAttributeMode } from "./EvidRubyAttributeMode";
import type { EvidRubyContainerKind } from "./EvidRubyContainerKind";
import type { EvidRubyDeclarationForm } from "./EvidRubyDeclarationForm";
import type { EvidRubyMethodSide } from "./EvidRubyMethodSide";
import type { EvidRubyVisibility } from "./EvidRubyVisibility";

/**
 * Captures one Ruby declaration before reopenings and runtime-name families reconcile.
 *
 * EvidRubyAdapterBase groups compatible records into semantic units after source-order
 * visibility changes, lexical ownership, and generated attribute surfaces are known.
 */
export interface IEvidRubyDeclaration {
  /**
   * Stable scanner identity for this declaration occurrence.
   *
   * Documentation attachments and materialization maps use it before grouping.
   */
  id: string;

  /**
   * Source name displayed by the resulting Evid unit.
   *
   * It can differ from `runtimeName` for generated accessors and singleton members.
   */
  name: string;

  /**
   * Ruby runtime name used to detect replacement and reopening conflicts.
   *
   * Grouping cannot infer overloads because later Ruby definitions replace earlier ones.
   */
  runtimeName: string;

  /**
   * Evid selector family assigned to this declaration.
   *
   * It distinguishes types, methods, and property-like constant or attribute surfaces.
   */
  symbol: EvidProgrammingSymbol;

  /**
   * Scanner form that establishes declaration-specific grouping rules.
   *
   * Constants, attributes, and methods have different redefinition boundaries.
   */
  form: EvidRubyDeclarationForm;

  /**
   * Semantic path used to group compatible declarations across files and reopenings.
   *
   * It remains separate from the file-qualified public address.
   */
  identity: string[];

  /**
   * Accessor segments published for this declaration in each selected source address.
   *
   * Method-side conventions remain encoded here rather than changing semantic identity.
   */
  address: string[];

  /**
   * Physical source site and content ranges contributing to this declaration.
   *
   * Reopened semantic units retain every compatible site for fingerprints and hosts.
   */
  site: IEvidUnitSite;

  /**
   * Visibility in effect at this declaration's source position.
   *
   * Only public records can publish a group, while conflicts remain diagnostics.
   */
  visibility: EvidRubyVisibility;

  /**
   * Whether this record defines rather than merely declares a Ruby surface.
   *
   * The adapter uses it to identify competing constant and method replacements.
   */
  definition: boolean;

  /**
   * Enclosing type identity when this declaration has a structural Ruby owner.
   *
   * Omission denotes a top-level declaration with no parent unit.
   */
  ownerIdentity?: string[];

  /**
   * Nominal container form when this record establishes a class or module.
   *
   * Compatible reopenings must preserve this kind.
   */
  containerKind?: EvidRubyContainerKind;

  /**
   * Receiver side on which Ruby installs a method or generated accessor.
   *
   * It disambiguates instance and singleton APIs below one owner.
   */
  side?: EvidRubyMethodSide;

  /**
   * Reader or writer capability represented by an attribute macro record.
   *
   * Omission means this declaration did not arise from an attribute macro.
   */
  attributeMode?: EvidRubyAttributeMode;

  /**
   * Explicit superclass spelling on a class declaration.
   *
   * Compatible reopenings may omit it, but conflicting supplied values make analysis incomplete.
   */
  superclass?: string;
}
