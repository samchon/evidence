/**
 * Records a file-backed Rust module awaiting selected-source resolution.
 *
 * EvidenceRustModuleResolver maps the declaration to an included file or
 * reports an incomplete crate graph instead of guessing filesystem or
 * build-script behavior.
 */
export interface IEvidenceRustExternalModule {
  /**
   * Scanner identity of the `mod` declaration introducing this module.
   *
   * Diagnostics refer to this source site when no selected file satisfies it.
   */
  declarationId: string;

  /**
   * Parent module path in which the child name resolves.
   *
   * It distinguishes equal module names declared under separate parents.
   */
  modulePath: string[];

  /**
   * Child module name from the declaration.
   *
   * The resolver combines it with `modulePath` to find the selected source.
   */
  name: string;

  /**
   * Whether a `#[path]` attribute supplies an explicit file spelling.
   *
   * This changes the selected-source lookup and prevents conventional-path
   * guessing.
   */
  pathOverride: boolean;
}
