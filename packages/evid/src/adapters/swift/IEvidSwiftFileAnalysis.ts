import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidSwiftDeclaration } from "./IEvidSwiftDeclaration";
import type { IEvidSwiftDocumentation } from "./IEvidSwiftDocumentation";

/**
 * Holds the node-free Swift extraction retained after a parse session closes.
 *
 * Module-wide nominal and alias resolution consumes these records after parsing,
 * so they retain source sites and boundaries without borrowing tree nodes.
 */
export interface IEvidSwiftFileAnalysis {
  /**
   * Original selected source snapshot.
   *
   * Materialization uses its physical path and configured addresses for units and hosts.
   */
  source: IEvidSourceFile;

  /**
   * Extracted declarations, including non-public boundaries.
   *
   * Ownership reconciliation needs inaccessible records to determine the public surface.
   */
  declarations: IEvidSwiftDeclaration[];

  /**
   * Classified documentation and unsupported annotation carriers.
   *
   * Unattached tag-bearing carriers remain available for diagnostic hosts.
   */
  documentation: IEvidSwiftDocumentation[];

  /**
   * Failures encountered while establishing the public surface.
   *
   * The adapter propagates them instead of treating omitted declarations as absent.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * States whether all surface-affecting Swift forms were classified.
   *
   * This failure signal is preserved through extension reconciliation so absent
   * declarations cannot disappear from the coverage denominator.
   */
  complete: boolean;
}
