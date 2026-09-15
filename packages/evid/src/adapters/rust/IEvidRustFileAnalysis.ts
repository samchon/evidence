import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidRustDeclaration } from "./IEvidRustDeclaration";
import type { IEvidRustDocumentation } from "./IEvidRustDocumentation";
import type { IEvidRustExternalModule } from "./IEvidRustExternalModule";
import type { IEvidRustImplementation } from "./IEvidRustImplementation";
import type { IEvidRustUse } from "./IEvidRustUse";

/**
 * Holds the node-free result of scanning one selected Rust source file.
 *
 * EvidRustModuleResolver consumes this record after the Tree-sitter session closes,
 * using its declarations and relationships to assemble the selected crate graph.
 */
export interface IEvidRustFileAnalysis {
  /**
   * Selected source file that supplied this extraction.
   *
   * Diagnostics and published addresses retain this file's physical and selected
   * locations rather than relying on transient parser nodes.
   */
  source: IEvidSourceFile;

  /**
   * Declarations read directly from this file.
   *
   * Their module paths remain relative to this file until module placement
   * assigns them to a crate.
   */
  declarations: IEvidRustDeclaration[];

  /**
   * Documentation records attached while comment positions are still available.
   *
   * The resolver may move inner documentation to an externally loaded module.
   */
  documentation: IEvidRustDocumentation[];

  /**
   * Out-of-line module declarations requiring selected-file resolution.
   *
   * Inline modules are represented directly in declarations and need no record.
   */
  externalModules: IEvidRustExternalModule[];

  /**
   * Impl blocks whose members require nominal-owner resolution.
   *
   * The scanner preserves source paths because imports and module placement can
   * affect the selected local owner.
   */
  implementations: IEvidRustImplementation[];

  /**
   * Public use declarations expanded into their statically spelled bindings.
   *
   * The resolver turns these bindings into exported public paths.
   */
  uses: IEvidRustUse[];

  /**
   * Errors found while scanning forms or attributes in this file.
   *
   * These diagnostics join resolver diagnostics in the final inventory.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * Whether scanning established the complete supported declaration population.
   *
   * False prevents an unsupported public form from silently shrinking coverage.
   */
  complete: boolean;
}
