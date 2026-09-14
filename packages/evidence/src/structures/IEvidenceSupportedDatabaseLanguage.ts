import type { EvidenceDatabaseType } from "../typings/EvidenceDatabaseType";
import type { IEvidenceDatabaseLanguageAdapter } from "./IEvidenceDatabaseLanguageAdapter";
import type { IEvidenceLanguageGrammar } from "./IEvidenceLanguageGrammar";

/** One shipped programming adapter and its exact registry capabilities. */
export interface IEvidenceSupportedDatabaseLanguage {
  type: EvidenceDatabaseType;
  name: string;
  grammars: IEvidenceLanguageGrammar[];
  adapter: IEvidenceDatabaseLanguageAdapter;
}
