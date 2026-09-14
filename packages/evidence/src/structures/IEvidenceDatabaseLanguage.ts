import type { EvidenceDatabaseType } from "../typings/EvidenceDatabaseType";
import type { IEvidenceDatabaseLanguageAdapter } from "./IEvidenceDatabaseLanguageAdapter";
import type { IEvidenceLanguageGrammar } from "./IEvidenceLanguageGrammar";

/** Separates available parsing grammars from certified Evidence extraction. */
export interface IEvidenceDatabaseLanguage {
  /** Configured database language identifier. */
  type: EvidenceDatabaseType;

  /** Display name of the configured schema language. */
  name: string;

  /** Pinned grammar variants and their selected logical file patterns. */
  grammars: IEvidenceLanguageGrammar[];

  /** Absent until declaration, visibility, ownership, and host extraction are certified. */
  adapter?: IEvidenceDatabaseLanguageAdapter;
}
