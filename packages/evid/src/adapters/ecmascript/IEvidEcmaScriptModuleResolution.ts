import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceDependency } from "../../structures/IEvidSourceDependency";
import type { EvidEcmaScriptModuleMode } from "./EvidEcmaScriptModuleMode";

/**
 * Module-mode selection and its evidence for an ECMAScript source snapshot.
 *
 * The adapter consumes this result before parsing files so scanner behavior uses
 * the selected ESM or CommonJS semantics and inventory completeness preserves
 * any package-metadata failure.
 */
export interface IEvidEcmaScriptModuleResolution {
  /**
   * Module semantics selected for each captured source ID.
   *
   * Each source must select one mode across all of its logical addresses before
   * the scanner interprets its import and export syntax.
   */
  modes: Map<string, EvidEcmaScriptModuleMode>;

  /**
   * Package metadata paths whose changes can alter mode selection.
   *
   * The watcher retains these exact dependencies, including missing manifests,
   * so creating or repairing package metadata triggers reevaluation.
   */
  dependencies: IEvidSourceDependency[];

  /**
   * Failures encountered while reading or interpreting package metadata.
   *
   * The adapter adds these findings to the inventory instead of continuing with
   * an apparently successful result built from incomplete mode information.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * Whether mode selection completed without diagnostics.
   *
   * False prevents the final inventory from proving coverage while still
   * retaining the fallback modes and actionable failures.
   */
  complete: boolean;
}
