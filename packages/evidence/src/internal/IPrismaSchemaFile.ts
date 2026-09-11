import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";

/** One deduplicated physical schema file and its parser-facing name. */
export interface IPrismaSchemaFile {
  name: string;
  source: IEvidenceSourceFile;
}
