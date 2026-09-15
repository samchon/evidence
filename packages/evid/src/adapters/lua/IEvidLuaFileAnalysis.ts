import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidLuaDeclaration } from "./IEvidLuaDeclaration";
import type { IEvidLuaDocumentation } from "./IEvidLuaDocumentation";

/**
 * Holds the node-free Lua extraction retained after a parse session closes.
 *
 * Static initialization is interpreted only while scanning; this record carries
 * the resulting public-value candidates into inventory materialization.
 */
export interface IEvidLuaFileAnalysis {
  /**
   * Retains the selected Lua source file that produced this analysis.
   *
   * Its physical identity and configured addresses are used when units and
   * comment hosts are materialized.
   */
  source: IEvidSourceFile;

  /**
   * Lists declarations and alias projections established by supported static
   * initialization.
   *
   * `EvidLuaAdapterBase` reconciles these node-free records into public units
   * after scanning ends.
   */
  declarations: IEvidLuaDeclaration[];

  /**
   * Lists classified LuaDoc and unsupported annotation carriers from this file.
   *
   * Tagged unsupported carriers remain available for diagnostics instead of
   * silently disappearing.
   */
  documentation: IEvidLuaDocumentation[];

  /**
   * Lists failures encountered while establishing the static public surface.
   *
   * The adapter forwards them into the inventory together with the `complete`
   * boundary.
   */
  diagnostics: IEvidDiagnostic[];

  /**
   * States whether static extraction understood every relevant source form.
   *
   * A false value keeps unsupported dynamic behavior visible to callers rather
   * than treating an incomplete table projection as an empty public surface.
   */
  complete: boolean;
}
