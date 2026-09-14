import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { ILuaDeclaration } from "./ILuaDeclaration";
import type { ILuaDocumentation } from "./ILuaDocumentation";

/**
 * Holds the node-free Lua extraction retained after a parse session closes.
 *
 * Static initialization is interpreted only while scanning; this record carries
 * the resulting public-value candidates into inventory materialization.
 */
export interface ILuaFileAnalysis {
  /** Original selected source snapshot. */
  source: IEvidenceSourceFile;

  /** Public declarations and alias projections established by static initialization. */
  declarations: ILuaDeclaration[];

  /** Classified documentation and unsupported annotation carriers. */
  documentation: ILuaDocumentation[];

  /** Failures encountered while establishing the public surface. */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * States whether static extraction understood every relevant source form.
   *
   * A false value keeps unsupported dynamic behavior visible to callers rather
   * than treating an incomplete table projection as an empty public surface.
   */
  complete: boolean;
}
