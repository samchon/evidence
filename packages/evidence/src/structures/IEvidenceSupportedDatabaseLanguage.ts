import type { EvidenceDatabaseType } from "../typings/EvidenceDatabaseType";
import type { IEvidenceDatabaseLanguageAdapter } from "./IEvidenceDatabaseLanguageAdapter";
import type { IEvidenceLanguageGrammar } from "./IEvidenceLanguageGrammar";

/** One shipped database adapter and its exact registry capabilities. */
export interface IEvidenceSupportedDatabaseLanguage {
  /** Configured database language identifier. */
  type: EvidenceDatabaseType;
  /** Display name of the configured schema language. */
  name: string;
  /** Pinned grammar variants and their selected logical file patterns. */
  grammars: IEvidenceLanguageGrammar[];
  /** Certified schema extraction capabilities. */
  adapter: IEvidenceDatabaseLanguageAdapter;
}
