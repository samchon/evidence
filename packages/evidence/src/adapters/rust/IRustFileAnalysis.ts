import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IRustDeclaration } from "./IRustDeclaration";
import type { IRustDocumentation } from "./IRustDocumentation";
import type { IRustExternalModule } from "./IRustExternalModule";
import type { IRustImplementation } from "./IRustImplementation";
import type { IRustUse } from "./IRustUse";

/**
 * Holds the node-free result of scanning one selected Rust source file.
 *
 * RustModuleResolver consumes this record after the Tree-sitter session closes,
 * using its declarations and relationships to assemble the selected crate graph.
 */
export interface IRustFileAnalysis {
  /**
   * Selected source file that supplied this extraction.
   *
   * Diagnostics and published addresses retain this file's physical and selected
   * locations rather than relying on transient parser nodes.
   */
  source: IEvidenceSourceFile;

  /**
   * Declarations read directly from this file.
   *
   * Their module paths remain relative to this file until module placement
   * assigns them to a crate.
   */
  declarations: IRustDeclaration[];

  /**
   * Documentation records attached while comment positions are still available.
   *
   * The resolver may move inner documentation to an externally loaded module.
   */
  documentation: IRustDocumentation[];

  /**
   * Out-of-line module declarations requiring selected-file resolution.
   *
   * Inline modules are represented directly in declarations and need no record.
   */
  externalModules: IRustExternalModule[];

  /**
   * Impl blocks whose members require nominal-owner resolution.
   *
   * The scanner preserves source paths because imports and module placement can
   * affect the selected local owner.
   */
  implementations: IRustImplementation[];

  /**
   * Public use declarations expanded into their statically spelled bindings.
   *
   * The resolver turns these bindings into exported public paths.
   */
  uses: IRustUse[];

  /**
   * Errors found while scanning forms or attributes in this file.
   *
   * These diagnostics join resolver diagnostics in the final inventory.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * Whether scanning established the complete supported declaration population.
   *
   * False prevents an unsupported public form from silently shrinking coverage.
   */
  complete: boolean;
}
