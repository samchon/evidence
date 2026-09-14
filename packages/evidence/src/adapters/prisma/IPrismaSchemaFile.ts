import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";

/** One deduplicated physical schema file and its parser-facing name.
 *
 * Parser-facing names provide stable schema-set references while the source
 * snapshot remains the owner of content, digest, and physical coordinates.
 */
export interface IPrismaSchemaFile {
  /** Unique normalized name supplied to the multi-file parser. */
  name: string;

  /** Selected source snapshot represented by that parser-facing name. */
  source: IEvidenceSourceFile;
}
