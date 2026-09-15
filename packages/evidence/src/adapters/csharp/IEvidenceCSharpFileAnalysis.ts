import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceCSharpDeclaration } from "./IEvidenceCSharpDeclaration";
import type { IEvidenceCSharpDocumentation } from "./IEvidenceCSharpDocumentation";

/**
 * Carries one source file's C# extraction after its Tree-sitter session can
 * close.
 *
 * EvidenceCSharpFileScanner produces this node-free boundary between syntax
 * traversal and EvidenceCSharpAdapter materialization. The adapter reconciles
 * declarations across files, maps documentation to hosts, and propagates
 * incomplete extraction to the final inventory without retaining parser nodes.
 */
export interface IEvidenceCSharpFileAnalysis {
  /**
   * Identifies the source snapshot from which this extraction was produced.
   *
   * EvidenceCSharpAdapter uses its physical path for diagnostics and hosts and its
   * configured addresses when publishing declaration accessors.
   */
  source: IEvidenceSourceFile;

  /**
   * Collects C# declarations that still require partial-family reconciliation.
   *
   * Each record retains its physical site and documentation attachment identity
   * after parsing closes. Materialization merges compatible declarations and
   * decides which ones expose public units.
   */
  declarations: IEvidenceCSharpDeclaration[];

  /**
   * Collects XML documentation carriers with scanner-established attachments.
   *
   * Attached carriers supply Evidence tags for published units. Unattached or
   * unsupported annotation carriers remain available so the adapter can report
   * their diagnostics instead of silently discarding them.
   */
  documentation: IEvidenceCSharpDocumentation[];

  /**
   * Reports extraction problems that prevent this analysis from representing
   * its full source surface.
   *
   * The adapter copies these diagnostics to the final inventory and treats the
   * file as incomplete, preventing missing declarations from reducing
   * coverage.
   */
  diagnostics: IEvidenceDiagnostic[];

  /**
   * States whether the scanner extracted every relevant supported construct.
   *
   * A false value propagates from unsupported or invalid source surfaces and
   * prevents coverage from passing with a partial file population.
   */
  complete: boolean;
}
