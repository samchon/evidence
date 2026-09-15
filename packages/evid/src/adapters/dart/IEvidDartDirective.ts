import type { IEvidDartExportFilter } from "./IEvidDartExportFilter";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";

/**
 * Records one static Dart library-topology directive.
 *
 * EvidDartFileScanner retains this source-level relationship for
 * EvidDartLibraries, which resolves selected files, validates part ownership,
 * and projects exports into the public inventory without evaluating Dart.
 */
export interface IEvidDartDirective {
  /**
   * Identifies the library relationship expressed by this directive.
   *
   * EvidDartLibraries uses `part` and `part-of` to establish a shared library
   * and applies export projection only for `export`.
   */
  kind: "part" | "part-of" | "export";

  /**
   * Names the decoded URI target or named `part of` library.
   *
   * Its interpretation depends on {@link named}: URI targets are resolved
   * against selected source locations, while named libraries match
   * declarations.
   */
  target: string;

  /**
   * Distinguishes a named `part of` library from a URI target.
   *
   * This preserves the grammar-level target form so resolution does not treat a
   * dotted library name as a physical file address.
   */
  named: boolean;

  /**
   * Gives the selected physical file resolved from a URI target.
   *
   * Omission means the target is named or URI resolution did not produce one
   * unambiguous selected file; the library pass reports the latter condition.
   */
  resolved?: string;

  /**
   * Retains export combinators in their source order.
   *
   * EvidDartLibraries applies each filter to a candidate exported declaration,
   * so a `show` intersects the population and a `hide` subtracts from it.
   */
  filters: IEvidDartExportFilter[];

  /**
   * Locates the complete directive in the original source.
   *
   * Resolution and topology diagnostics cite this half-open UTF-16 range rather
   * than a synthesized library relationship.
   */
  range: IEvidSourceRange;
}
