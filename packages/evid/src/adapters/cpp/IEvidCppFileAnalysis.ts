import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidCppAlias } from "./IEvidCppAlias";
import type { IEvidCppDeclaration } from "./IEvidCppDeclaration";
import type { IEvidCppDocumentation } from "./IEvidCppDocumentation";

/** Holds the complete node-free extraction for one scanned C++ source file.
 *
 * `EvidCppFileScanner` returns this boundary after its parse session closes. `EvidCppAdapterBase` consumes the records to reconcile declaration families, resolve aliases, and materialize documentation without retaining Tree-sitter nodes.
 */
export interface IEvidCppFileAnalysis {
  /** Captured source file that owns every record in this analysis.
   *
   * `EvidCppAdapterBase` uses its physical path and configured addresses while it materializes units and documentation hosts.
   */
  source: IEvidSourceFile;

  /** Declaration records awaiting family and ownership reconciliation.
   *
   * The adapter groups compatible records into semantic units after scanning; they remain node-free after the parser session closes.
   */
  declarations: IEvidCppDeclaration[];

  /** Supported namespace and using aliases found in this physical file.
   *
   * `EvidCppAdapterBase` resolves them only after materializing selected units, because an alias must identify exactly one target unit.
   */
  aliases: IEvidCppAlias[];

  /** Doxygen blocks and their scanner-established declaration attachments.
   *
   * The adapter parses attached blocks into hosts after publication; annotation-bearing blocks without a supported attachment remain diagnostic candidates.
   */
  documentation: IEvidCppDocumentation[];

  /** Extraction problems that prevent this file from forming a complete inventory.
   *
   * Inventory consumers retain these diagnostics so unsupported syntax cannot silently shrink the coverage population.
   */
  diagnostics: IEvidDiagnostic[];

  /** Whether the scanner understood every relevant supported surface in the file.
   *
   * `false` survives materialization so an incomplete scan cannot pass coverage over a reduced population.
   */
  complete: boolean;
}
