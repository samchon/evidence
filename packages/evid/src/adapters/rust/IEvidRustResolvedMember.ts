import type { IEvidRustLocatedDeclaration } from "./IEvidRustLocatedDeclaration";

/**
 * Assigns one associated Rust item to its selected local nominal owner.
 *
 * Resolver materialization uses the relationship to publish public impl members
 * beneath the owner type rather than as standalone declarations.
 */
export interface IEvidRustResolvedMember {
  /**
   * Located associated declaration emitted from the impl block.
   *
   * Its identity is updated after the owner and optional trait are resolved.
   */
  declaration: IEvidRustLocatedDeclaration;

  /**
   * Selected local struct or enum that semantically owns the member.
   *
   * Only one unambiguous nominal owner is supported for publication.
   */
  owner: IEvidRustLocatedDeclaration;

  /**
   * Trait-derived segment that distinguishes a trait impl from an inherent
   * impl.
   *
   * Omission means the member belongs to an inherent impl.
   */
  qualifier?: string;

  /**
   * Declaration ID of the selected local trait, when the trait resolved
   * locally.
   *
   * Materialization requires that trait to be publicly reachable before
   * exposing its impl members.
   */
  localTraitId?: string;
}
