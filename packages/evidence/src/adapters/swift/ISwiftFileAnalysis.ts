import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { ISwiftDeclaration } from "./ISwiftDeclaration";
import type { ISwiftDocumentation } from "./ISwiftDocumentation";

/**
 * Holds the node-free Swift extraction retained after a parse session closes.
 *
 * Module-wide nominal and alias resolution consumes these records after parsing,
 * so they retain source sites and boundaries without borrowing tree nodes.
 */
export interface ISwiftFileAnalysis {
  /**
   * Original selected source snapshot.
   *
   * Materialization uses its physical path and configured addresses for units and hosts.
   */
  source: IEvidenceSourceFile;

  /**
   * Extracted declarations, including non-public boundaries.
   *
   * Ownership reconciliation needs inaccessible records to determine the public surface.
   */
  declarations: ISwiftDeclaration[];

  /**
   * Classified documentation and unsupported annotation carriers.
   *
   * Unattached tag-bearing carriers remain available for diagnostic hosts.
   */
  documentation: ISwiftDocumentation[];

  /**
   * Failures encountered while establishing the public surface.
   *
   * The adapter propagates them instead of treating omitted declarations as absent.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * States whether all surface-affecting Swift forms were classified.
   *
   * This failure signal is preserved through extension reconciliation so absent
   * declarations cannot disappear from the coverage denominator.
   */
  complete: boolean;
}
