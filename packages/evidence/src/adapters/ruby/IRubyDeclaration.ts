import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { RubyAttributeMode } from "./RubyAttributeMode";
import type { RubyContainerKind } from "./RubyContainerKind";
import type { RubyDeclarationForm } from "./RubyDeclarationForm";
import type { RubyMethodSide } from "./RubyMethodSide";
import type { RubyVisibility } from "./RubyVisibility";

/**
 * Captures one Ruby declaration before reopenings and runtime-name families reconcile.
 *
 * RubyAdapter groups compatible records into semantic units after source-order
 * visibility changes, lexical ownership, and generated attribute surfaces are known.
 */
export interface IRubyDeclaration {
  /**
   * Stable scanner identity for this declaration occurrence.
   *
   * Documentation attachments and materialization maps use it before grouping.
   */
  id: string;

  /**
   * Source name displayed by the resulting Evidence unit.
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
   * Evidence selector family assigned to this declaration.
   *
   * It distinguishes types, methods, and property-like constant or attribute surfaces.
   */
  symbol: EvidenceProgrammingSymbol;

  /**
   * Scanner form that establishes declaration-specific grouping rules.
   *
   * Constants, attributes, and methods have different redefinition boundaries.
   */
  form: RubyDeclarationForm;

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
  site: IEvidenceUnitSite;

  /**
   * Visibility in effect at this declaration's source position.
   *
   * Only public records can publish a group, while conflicts remain diagnostics.
   */
  visibility: RubyVisibility;

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
  containerKind?: RubyContainerKind;

  /**
   * Receiver side on which Ruby installs a method or generated accessor.
   *
   * It disambiguates instance and singleton APIs below one owner.
   */
  side?: RubyMethodSide;

  /**
   * Reader or writer capability represented by an attribute macro record.
   *
   * Omission means this declaration did not arise from an attribute macro.
   */
  attributeMode?: RubyAttributeMode;

  /**
   * Explicit superclass spelling on a class declaration.
   *
   * Compatible reopenings may omit it, but conflicting supplied values make analysis incomplete.
   */
  superclass?: string;
}
