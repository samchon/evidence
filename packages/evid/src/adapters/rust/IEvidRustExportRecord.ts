import type { IEvidRustDeclaration } from "./IEvidRustDeclaration";
import type { IEvidRustFilePlacement } from "./IEvidRustFilePlacement";

/**
 * Describes one public Rust module binding and the file that exposes its alias.
 *
 * Resolver traversal carries the declaration and its module placement together
 * so visibility is evaluated at the binding boundary instead of the use site
 * alone.
 */
export interface IEvidRustExportRecord {
  /**
   * Name introduced into the exporting module's public namespace.
   *
   * It forms the next segment when the resolver publishes an alias path.
   */
  name: string;

  /**
   * Lexical declaration reached by this binding before alias publication.
   *
   * Its semantic identity is retained even when several paths expose it.
   */
  declaration: IEvidRustDeclaration;

  /**
   * Selected file and crate placement owning the exposing module.
   *
   * Visibility checks need this module boundary as well as the declaration.
   */
  carrier: IEvidRustFilePlacement;
}
