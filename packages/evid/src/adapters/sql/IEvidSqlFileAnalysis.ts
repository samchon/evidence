import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidSqlDeclaration } from "./IEvidSqlDeclaration";
import type { IEvidSqlDocumentation } from "./IEvidSqlDocumentation";

/**
 * Retains a node-free SQL extraction after its parse session closes.
 *
 * SQL adapters transfer this serializable analysis to later inventory and
 * documentation phases without retaining Tree-sitter nodes or session state.
 */
export interface IEvidSqlFileAnalysis {
  /**
   * Preserves the selected source snapshot whose coordinates records use.
   *
   * Consumers use this source to retain the physical file boundary of every
   * declaration, comment, and diagnostic.
   */
  source: IEvidSourceFile;

  /**
   * Contains declarations extracted from recognized schema syntax.
   *
   * The collection includes non-public structural boundaries needed to build a
   * faithful inventory before public selection is projected.
   */
  declarations: IEvidSqlDeclaration[];

  /**
   * Contains classified comments and unsupported annotation carriers.
   *
   * Detached carriers remain here so later phases can report their annotations
   * instead of treating absence of an attachment as absence of evidence.
   */
  documentation: IEvidSqlDocumentation[];

  /**
   * Records failures encountered while establishing the schema surface.
   *
   * These diagnostics explain why callers must not trust a partial extraction
   * as a complete selected population.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * States whether every relevant declaration form was understood.
   *
   * A false value prevents unsupported source from making coverage pass by
   * shrinking the discovered inventory.
   */
  complete: boolean;
}
