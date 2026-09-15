import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { EvidenceEcmaScriptModuleMode } from "./EvidenceEcmaScriptModuleMode";
import type { IEvidenceEcmaScriptComment } from "./IEvidenceEcmaScriptComment";
import type { IEvidenceEcmaScriptExport } from "./IEvidenceEcmaScriptExport";
import type { IEvidenceEcmaScriptImport } from "./IEvidenceEcmaScriptImport";
import type { IEvidenceEcmaScriptHostPosition } from "./IEvidenceEcmaScriptHostPosition";
import type { IEvidenceEcmaScriptOwnedUnit } from "./IEvidenceEcmaScriptOwnedUnit";

/**
 * Retains the node-free result of scanning one ECMAScript-family source file.
 *
 * The adapter combines these records after parsing ends to resolve exports,
 * materialize documentation hosts, and preserve incomplete analysis as
 * failure.
 */
export interface IEvidenceEcmaScriptFileAnalysis {
  /**
   * Source snapshot that owns every extracted module record.
   *
   * Its physical path remains the basis for diagnostics and host locations.
   */
  source: IEvidenceSourceFile;

  /**
   * Module semantics selected from syntax or JavaScript package scope.
   *
   * This governs which export and import forms the scanner may interpret.
   */
  mode: EvidenceEcmaScriptModuleMode;

  /**
   * Local semantic units before export reachability filters publication.
   *
   * Each entry preserves its root binding and type/value-space ownership.
   */
  units: IEvidenceEcmaScriptOwnedUnit[];

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
  exports: IEvidenceEcmaScriptExport[];

  /**
   * Static imported bindings that local exports may forward.
   *
   * Dynamic loading is deliberately outside the declared-source boundary.
   */
  imports: IEvidenceEcmaScriptImport[];

  /**
   * Declaration positions eligible to become undocumented evidence hosts.
   *
   * They keep source ownership separate from semantic unit identity.
   */
  positions: IEvidenceEcmaScriptHostPosition[];

  /**
   * Parsed comments with scanner-established JSDoc attachments.
   *
   * A textually similar unattached block cannot claim evidence.
   */
  comments: IEvidenceEcmaScriptComment[];

  /**
   * Parse or unsupported-surface findings retained for the final inventory.
   *
   * Consumers must see these rather than receive a smaller passing population.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * Whether scanning represented every relevant supported source construct.
   *
   * Completeness participates in the adapter's final failure state.
   */
  complete: boolean;
}
