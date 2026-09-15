import type { IEvidUnitSite } from "../../structures/IEvidUnitSite";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";
import type { EvidRustDeclarationForm } from "./EvidRustDeclarationForm";
import type { EvidRustVisibility } from "./EvidRustVisibility";

/**
 * Captures one Rust declaration before module reachability and impl ownership resolve.
 *
 * EvidRustModuleResolver combines this lexical record with the selected crate graph;
 * scanners do not assume that a visible spelling is externally reachable.
 */
export interface IEvidRustDeclaration {
  /**
   * Stable scanner identity for this declaration.
   *
   * Modules, implementations, and documentation attachments use it before semantic IDs exist.
   */
  id: string;

  /**
   * Lexical module segments containing the declaration.
   *
   * Public aliases expand from this location only after crate graph resolution.
   */
  modulePath: string[];

  /**
   * Source name used as the final identity or member segment.
   *
   * The resolver preserves this spelling while it derives public paths.
   */
  name: string;

  /**
   * Evid selector family assigned to the declaration.
   *
   * Consumers distinguish nominal types, functions, and properties through this value.
   */
  symbol: EvidProgrammingSymbol;

  /**
   * Rust grammar form establishing the declaration.
   *
   * It selects the resolver's ownership and publication rules.
   */
  form: EvidRustDeclarationForm;

  /**
   * Lexical visibility controlling whether a use can publish this item.
   *
   * Its scope is evaluated at module boundaries rather than from the declaration alone.
   */
  visibility: EvidRustVisibility;

  /**
   * Source ranges used for documentation hosts and review fingerprints.
   *
   * They remain valid after the borrowed parser tree closes.
   */
  site: IEvidUnitSite;

  /**
   * Enclosing declaration identity for directly lexical members.
   *
   * Omission leaves owner resolution to a separate impl record or module context.
   */
  ownerDeclarationId?: string;

  /**
   * Impl record supplying a nominal owner after cross-module resolution.
   *
   * Omission means this declaration has no impl-mediated ownership.
   */
  implementationId?: string;

  /**
   * Public child segment when this declaration is an impl member.
   *
   * Omission keeps non-member declarations from acquiring an artificial accessor.
   */
  memberSegment?: string;
}
