import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { EvidEcmaScriptModuleMode } from "./EvidEcmaScriptModuleMode";
import type { IEvidEcmaScriptComment } from "./IEvidEcmaScriptComment";
import type { IEvidEcmaScriptExport } from "./IEvidEcmaScriptExport";
import type { IEvidEcmaScriptImport } from "./IEvidEcmaScriptImport";
import type { IEvidEcmaScriptHostPosition } from "./IEvidEcmaScriptHostPosition";
import type { IEvidEcmaScriptOwnedUnit } from "./IEvidEcmaScriptOwnedUnit";

/**
 * Retains the node-free result of scanning one ECMAScript-family source file.
 *
 * The adapter combines these records after parsing ends to resolve exports,
 * materialize documentation hosts, and preserve incomplete analysis as
 * failure.
 */
export interface IEvidEcmaScriptFileAnalysis {
  /**
   * Source snapshot that owns every extracted module record.
   *
   * Its physical path remains the basis for diagnostics and host locations.
   */
  source: IEvidSourceFile;

  /**
   * Module semantics selected from syntax or JavaScript package scope.
   *
   * This governs which export and import forms the scanner may interpret.
   */
  mode: EvidEcmaScriptModuleMode;

  /**
   * Local semantic units before export reachability filters publication.
   *
   * Each entry preserves its root binding and type/value-space ownership.
   */
  units: IEvidEcmaScriptOwnedUnit[];

  /**
   * Local roots withdrawn by supported visibility documentation.
   *
   * Export resolution carries the withdrawal through re-export paths.
   */
  excludedRoots: string[];

  /**
   * Static export edges used to calculate public reachability.
   *
   * The resolver evaluates the complete module graph before filtering units.
   */
  exports: IEvidEcmaScriptExport[];

  /**
   * Static imported bindings that local exports may forward.
   *
   * Dynamic loading is deliberately outside the declared-source boundary.
   */
  imports: IEvidEcmaScriptImport[];

  /**
   * Declaration positions eligible to become undocumented evidence hosts.
   *
   * They keep source ownership separate from semantic unit identity.
   */
  positions: IEvidEcmaScriptHostPosition[];

  /**
   * Parsed comments with scanner-established JSDoc attachments.
   *
   * A textually similar unattached block cannot claim evidence.
   */
  comments: IEvidEcmaScriptComment[];

  /**
   * Parse or unsupported-surface findings retained for the final inventory.
   *
   * Consumers must see these rather than receive a smaller passing population.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * Whether scanning represented every relevant supported source construct.
   *
   * Completeness participates in the adapter's final failure state.
   */
  complete: boolean;
}
