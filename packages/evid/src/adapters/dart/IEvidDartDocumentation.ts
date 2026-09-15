import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { IEvidDartDocumentationAttachment } from "./IEvidDartDocumentationAttachment";

/**
 * Represents a Dart documentation carrier or tag-bearing unsupported carrier.
 *
 * The scanner preserves unsupported tagged text as well as attached DartDoc so
 * the adapter can report a misplaced annotation instead of silently ignoring
 * it.
 */
export interface IEvidDartDocumentation {
  /**
   * Identifies this physical documentation carrier within the scanned source.
   *
   * Attachments and generated hosts use this scanner-local identity; it does
   * not name a semantic declaration.
   */
  id: string;

  /**
   * Locates the carrier's original half-open UTF-16 source span.
   *
   * The adapter preserves this position for diagnostics and annotation-range
   * exclusion.
   */
  range: IEvidSourceRange;

  /**
   * Defines the delimiters and annotation-reading rules for this carrier.
   *
   * Documentation parsing uses this syntax instead of reinterpreting raw Dart
   * source text.
   */
  syntax: IEvidCommentSyntax;

  /**
   * Lists supported declaration sites that accept this carrier as
   * documentation.
   *
   * Attachments are established by source adjacency before library and unit
   * reconciliation.
   */
  attachments: IEvidDartDocumentationAttachment[];
}
