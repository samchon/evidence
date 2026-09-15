import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";

/**
 * One deduplicated physical schema file and its parser-facing name.
 *
 * Parser-facing names provide stable schema-set references while the source
 * snapshot remains the owner of content, digest, and physical coordinates.
 */
export interface IEvidencePrismaSchemaFile {
  /**
   * Unique normalized name supplied to the multi-file parser.
   *
   * The parser uses this stable schema-set key for cross-file resolution; it is
   * derived independently of the source snapshot's physical filesystem path.
   */
  name: string;

  /**
   * Selected source snapshot represented by that parser-facing name.
   *
   * Its content enters the parser payload, while its digest and physical
   * identity remain available for cache keys and later location
   * materialization.
   */
  source: IEvidenceSourceFile;
}
