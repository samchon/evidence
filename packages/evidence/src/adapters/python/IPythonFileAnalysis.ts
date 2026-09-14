import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IPythonAll } from "./IPythonAll";
import type { IPythonBinding } from "./IPythonBinding";
import type { IPythonDocumentation } from "./IPythonDocumentation";
import type { IPythonHostPosition } from "./IPythonHostPosition";
import type { IPythonOwnedUnit } from "./IPythonOwnedUnit";

/**
 * Preserves one Python file's serializable extraction after parsing.
 *
 * PythonAdapter combines these records before resolving imports and exports, so
 * parser-owned nodes never escape their session and failures remain visible.
 */
export interface IPythonFileAnalysis {
  /**
   * Selected source whose declarations and diagnostics this analysis owns.
   *
   * Its physical path anchors units, annotation ranges, and diagnostic locations.
   */
  source: IEvidenceSourceFile;

  /**
   * Static knowledge of the module's explicit export list.
   *
   * The resolver falls back to underscore-based visibility only when this state permits it.
   */
  all: IPythonAll;

  /**
   * Source-ordered namespace bindings available to export resolution.
   *
   * Later entries may replace earlier names under Python binding semantics.
   */
  bindings: IPythonBinding[];

  /**
   * Lexically scanned declarations awaiting public-path publication.
   *
   * Entries can be removed when no supported export reaches their root.
   */
  units: IPythonOwnedUnit[];

  /**
   * Declaration sites that may receive a documentation host.
   *
   * Positions keep shared accessors from producing duplicate hosts.
   */
  positions: IPythonHostPosition[];

  /**
   * Parsed docstrings and adjacent comment runs from this file.
   *
   * Attachment is deferred until the exported population is known.
   */
  documentation: IPythonDocumentation[];

  /**
   * Source failures encountered while classifying this file.
   *
   * They are carried into the inventory so incomplete extraction cannot certify coverage.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * Whether scanning classified every surface-changing construct in this file.
   *
   * A false value propagates to the completed inventory even if other files succeed.
   */
  complete: boolean;
}
