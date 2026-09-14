import type { IRustDeclaration } from "./IRustDeclaration";
import type { IRustFilePlacement } from "./IRustFilePlacement";

/**
 * Describes one public Rust module binding and the file that exposes its alias.
 *
 * Resolver traversal carries the declaration and its module placement together
 * so visibility is evaluated at the binding boundary instead of the use site alone.
 */
export interface IRustExportRecord {
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
  declaration: IRustDeclaration;

  /**
   * Selected file and crate placement owning the exposing module.
   *
   * Visibility checks need this module boundary as well as the declaration.
   */
  carrier: IRustFilePlacement;
}
