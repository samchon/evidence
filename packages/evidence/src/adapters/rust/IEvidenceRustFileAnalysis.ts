import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceRustDeclaration } from "./IEvidenceRustDeclaration";
import type { IEvidenceRustDocumentation } from "./IEvidenceRustDocumentation";
import type { IEvidenceRustExternalModule } from "./IEvidenceRustExternalModule";
import type { IEvidenceRustImplementation } from "./IEvidenceRustImplementation";
import type { IEvidenceRustUse } from "./IEvidenceRustUse";

/**
 * Holds the node-free result of scanning one selected Rust source file.
 *
 * EvidenceRustModuleResolver consumes this record after the Tree-sitter session
 * closes, using its declarations and relationships to assemble the selected
 * crate graph.
 */
export interface IEvidenceRustFileAnalysis {
  /**
   * Selected source file that supplied this extraction.
   *
   * Diagnostics and published addresses retain this file's physical and
   * selected locations rather than relying on transient parser nodes.
   */
  source: IEvidenceSourceFile;

  /**
   * Declarations read directly from this file.
   *
   * Their module paths remain relative to this file until module placement
   * assigns them to a crate.
   */
  declarations: IEvidenceRustDeclaration[];

  /**
   * Documentation records attached while comment positions are still available.
   *
   * The resolver may move inner documentation to an externally loaded module.
   */
  documentation: IEvidenceRustDocumentation[];

  /**
   * Out-of-line module declarations requiring selected-file resolution.
   *
   * Inline modules are represented directly in declarations and need no record.
   */
  externalModules: IEvidenceRustExternalModule[];

  /**
   * Impl blocks whose members require nominal-owner resolution.
   *
   * The scanner preserves source paths because imports and module placement can
   * affect the selected local owner.
   */
  implementations: IEvidenceRustImplementation[];

  /**
   * Public use declarations expanded into their statically spelled bindings.
   *
   * The resolver turns these bindings into exported public paths.
   */
  uses: IEvidenceRustUse[];

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
