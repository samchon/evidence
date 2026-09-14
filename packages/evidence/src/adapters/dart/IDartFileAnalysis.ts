import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IDartDirective } from "./IDartDirective";
import type { IDartDeclaration } from "./IDartDeclaration";
import type { IDartDocumentation } from "./IDartDocumentation";

/**
 * Holds the node-free Dart extraction retained after a parse session closes.
 *
 * Library resolution consumes this intermediate record across every selected
 * file, so parser nodes cannot be retained and physical source remains explicit.
 */
export interface IDartFileAnalysis {
  /** Gives the selected physical path of the defining library.
   *
   * Part files adopt this owner during topology resolution instead of becoming independent public files.
   */
  library: string;

  /** Gives the optional named library declaration or `part of` name.
   *
   * Omission denotes an unnamed library; named values let topology resolution match named part owners.
   */
  libraryName?: string;

  /** Lists library topology directives retained for snapshot-wide resolution.
   *
   * `DartLibraries` consumes parts and exports to establish ownership and projected public addresses.
   */
  directives: IDartDirective[];

  /** Retains the selected source file that produced this analysis.
   *
   * Its physical identity and configured addresses are used when units and documentation hosts are materialized.
   */
  source: IEvidenceSourceFile;

  /** Lists extracted declarations, including non-public ownership boundaries.
   *
   * Topology resolution consumes these physical records before selecting public units.
   */
  declarations: IDartDeclaration[];

  /** Lists classified DartDoc and unsupported annotation carriers in this file.
   *
   * The adapter keeps tagged unsupported carriers so they can produce diagnostics rather than disappear.
   */
  documentation: IDartDocumentation[];

  /** Lists failures encountered while establishing this file's public surface.
   *
   * The adapter forwards them into the inventory alongside the `complete` boundary.
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
