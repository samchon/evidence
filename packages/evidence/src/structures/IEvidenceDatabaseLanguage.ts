import type { EvidenceDatabaseType } from "../typings/EvidenceDatabaseType";
import type { IEvidenceDatabaseLanguageAdapter } from "./IEvidenceDatabaseLanguageAdapter";
import type { IEvidenceLanguageGrammar } from "./IEvidenceLanguageGrammar";

/** Separates available parsing grammars from certified Evidence extraction. */
export interface IEvidenceDatabaseLanguage {
  type: EvidenceDatabaseType;
  name: string;
  grammars: IEvidenceLanguageGrammar[];
  /** Absent until declaration, visibility, ownership, and host extraction are certified. */
  adapter?: IEvidenceDatabaseLanguageAdapter;
}
