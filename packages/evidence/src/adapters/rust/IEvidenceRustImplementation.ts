/**
 * Describes a Rust impl block before its local nominal owner is resolved.
 *
 * The scanner records source-level paths; EvidenceRustModuleResolver resolves
 * them in the containing module and assigns member identities to the selected
 * owner.
 */
export interface IEvidenceRustImplementation {
  /**
   * Stable scanner ID shared by declarations emitted from this impl block.
   *
   * The resolver uses it to select exactly this block's associated members.
   */
  id: string;

  /**
   * Module path relative to the scanned file where the impl appears.
   *
   * Placement prepends the file prefix before path resolution.
   */
  modulePath: string[];

  /**
   * Source path naming the implemented nominal type.
   *
   * It must resolve to one selected local struct or enum before members
   * publish.
   */
  ownerPath: string[];

  /**
   * Source path naming the implemented trait, when this is a trait impl.
   *
   * Omission represents an inherent impl and produces no trait qualifier.
   */
  traitPath?: string[];

  /**
   * Type parameter names declared by the impl block.
   *
   * The resolver uses them to reject blanket impls without one nominal owner.
   */
  typeParameters: string[];
}
