import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { EvidenceRustDeclarationForm } from "./EvidenceRustDeclarationForm";
import type { EvidenceRustVisibility } from "./EvidenceRustVisibility";

/**
 * Captures one Rust declaration before module reachability and impl ownership
 * resolve.
 *
 * EvidenceRustModuleResolver combines this lexical record with the selected
 * crate graph; scanners do not assume that a visible spelling is externally
 * reachable.
 */
export interface IEvidenceRustDeclaration {
  /**
   * Stable scanner identity for this declaration.
   *
   * Modules, implementations, and documentation attachments use it before
   * semantic IDs exist.
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
   * Evidence selector family assigned to the declaration.
   *
   * Consumers distinguish nominal types, functions, and properties through this
   * value.
   */
  symbol: EvidenceProgrammingSymbol;

  /**
   * Rust grammar form establishing the declaration.
   *
   * It selects the resolver's ownership and publication rules.
   */
  form: EvidenceRustDeclarationForm;

  /**
   * Lexical visibility controlling whether a use can publish this item.
   *
   * Its scope is evaluated at module boundaries rather than from the
   * declaration alone.
   */
  visibility: EvidenceRustVisibility;

  /**
   * Source ranges used for documentation hosts and review fingerprints.
   *
   * They remain valid after the borrowed parser tree closes.
   */
  site: IEvidenceUnitSite;

  /**
   * Enclosing declaration identity for directly lexical members.
   *
   * Omission leaves owner resolution to a separate impl record or module
   * context.
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
   * Omission keeps non-member declarations from acquiring an artificial
   * accessor.
   */
  memberSegment?: string;
}
