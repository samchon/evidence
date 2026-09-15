import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceDartDirective } from "./IEvidenceDartDirective";
import type { IEvidenceDartDeclaration } from "./IEvidenceDartDeclaration";
import type { IEvidenceDartDocumentation } from "./IEvidenceDartDocumentation";

/**
 * Holds the node-free Dart extraction retained after a parse session closes.
 *
 * Library resolution consumes this intermediate record across every selected
 * file, so parser nodes cannot be retained and physical source remains
 * explicit.
 */
export interface IEvidenceDartFileAnalysis {
  /**
   * Gives the selected physical path of the defining library.
   *
   * Part files adopt this owner during topology resolution instead of becoming
   * independent public files.
   */
  library: string;

  /**
   * Gives the optional named library declaration or `part of` name.
   *
   * Omission denotes an unnamed library; named values let topology resolution
   * match named part owners.
   */
  libraryName?: string;

  /**
   * Lists library topology directives retained for snapshot-wide resolution.
   *
   * `EvidenceDartLibraries` consumes parts and exports to establish ownership and
   * projected public addresses.
   */
  directives: IEvidenceDartDirective[];

  /**
   * Retains the selected source file that produced this analysis.
   *
   * Its physical identity and configured addresses are used when units and
   * documentation hosts are materialized.
   */
  source: IEvidenceSourceFile;

  /**
   * Lists extracted declarations, including non-public ownership boundaries.
   *
   * Topology resolution consumes these physical records before selecting public
   * units.
   */
  declarations: IEvidenceDartDeclaration[];

  /**
   * Lists classified DartDoc and unsupported annotation carriers in this file.
   *
   * The adapter keeps tagged unsupported carriers so they can produce
   * diagnostics rather than disappear.
   */
  documentation: IEvidenceDartDocumentation[];

  /**
   * Lists failures encountered while establishing this file's public surface.
   *
   * The adapter forwards them into the inventory alongside the `complete`
   * boundary.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * States whether scanning classified every surface-affecting form.
   *
   * A false value survives topology resolution and prevents missing syntax from
   * reducing the population used to evaluate coverage.
   */
  complete: boolean;
}
