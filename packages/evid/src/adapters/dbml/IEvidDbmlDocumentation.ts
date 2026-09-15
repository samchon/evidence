import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";

/**
 * Represents one DBML comment or note after its declaration owners are known.
 *
 * The scanner retains this carrier so later graph assembly can parse annotation
 * tags without rediscovering DBML attachment rules.
 */
export interface IEvidDbmlDocumentation {
  /**
   * Identifies declarations documented by this carrier.
   *
   * Each nested path preserves the literal DBML identity found by the scanner.
   */
  owners: string[][];

  /**
   * Locates the original comment or note string in the source file.
   *
   * Consumers use this range when reporting annotation syntax and diagnostics.
   */
  range: IEvidSourceRange;

  /**
   * Covers complete annotation syntax excluded from semantic fingerprints.
   *
   * It can include delimiters outside the readable documentation range.
   */
  annotationRange: IEvidSourceRange;

  /**
   * Describes delimiters used to decode this documentation carrier.
   *
   * EvidDocumentation uses it to map decoded characters to source offsets.
   */
  syntax: IEvidCommentSyntax;
}
