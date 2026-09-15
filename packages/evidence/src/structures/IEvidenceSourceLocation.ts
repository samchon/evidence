import type { IEvidenceSourceRange } from "./IEvidenceSourceRange";

/**
 * Source coordinate suitable for both declarations and file-level failures.
 *
 * Extraction can identify a file even when reading or parsing it fails before a
 * span exists. The optional range preserves that distinction instead of
 * inventing a line number for diagnostics without a concrete source position.
 */
export interface IEvidenceSourceLocation {
  /**
   * File associated with the declaration or diagnostic.
   *
   * Reporters can display this path even when no source range is available.
   */
  file: string;

  /**
   * Source span narrowing the location within the file.
   *
   * Omission denotes file-level context; when present, its start supplies the
   * line and column displayed by text reporters.
   */
  range?: IEvidenceSourceRange;
}
