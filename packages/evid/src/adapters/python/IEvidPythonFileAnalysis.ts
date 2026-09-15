import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidPythonAll } from "./IEvidPythonAll";
import type { IEvidPythonBinding } from "./IEvidPythonBinding";
import type { IEvidPythonDocumentation } from "./IEvidPythonDocumentation";
import type { IEvidPythonHostPosition } from "./IEvidPythonHostPosition";
import type { IEvidPythonOwnedUnit } from "./IEvidPythonOwnedUnit";

/**
 * Preserves one Python file's serializable extraction after parsing.
 *
 * EvidPythonAdapter combines these records before resolving imports and
 * exports, so parser-owned nodes never escape their session and failures remain
 * visible.
 */
export interface IEvidPythonFileAnalysis {
  /**
   * Selected source whose declarations and diagnostics this analysis owns.
   *
   * Its physical path anchors units, annotation ranges, and diagnostic
   * locations.
   */
  source: IEvidSourceFile;

  /**
   * Static knowledge of the module's explicit export list.
   *
   * The resolver falls back to underscore-based visibility only when this state
   * permits it.
   */
  all: IEvidPythonAll;

  /**
   * Source-ordered namespace bindings available to export resolution.
   *
   * Later entries may replace earlier names under Python binding semantics.
   */
  bindings: IEvidPythonBinding[];

  /**
   * Lexically scanned declarations awaiting public-path publication.
   *
   * Entries can be removed when no supported export reaches their root.
   */
  units: IEvidPythonOwnedUnit[];

  /**
   * Declaration sites that may receive a documentation host.
   *
   * Positions keep shared accessors from producing duplicate hosts.
   */
  positions: IEvidPythonHostPosition[];

  /**
   * Parsed docstrings and adjacent comment runs from this file.
   *
   * Attachment is deferred until the exported population is known.
   */
  documentation: IEvidPythonDocumentation[];

  /**
   * Source failures encountered while classifying this file.
   *
   * They are carried into the inventory so incomplete extraction cannot certify
   * coverage.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * Whether scanning classified every surface-changing construct in this file.
   *
   * A false value propagates to the completed inventory even if other files
   * succeed.
   */
  complete: boolean;
}
