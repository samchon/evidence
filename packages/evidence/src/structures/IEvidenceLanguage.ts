import type { EvidenceProgrammingType } from "../typings/EvidenceProgrammingType";
import type { IEvidenceLanguageAdapter } from "./IEvidenceLanguageAdapter";
import type { IEvidenceLanguageGrammar } from "./IEvidenceLanguageGrammar";

/** Separates available parsing grammars from certified Evidence extraction. */
export interface IEvidenceLanguage {
  type: EvidenceProgrammingType;
  name: string;
  grammars: IEvidenceLanguageGrammar[];
  /** Absent until declaration, visibility, ownership, and host extraction are certified. */
  adapter?: IEvidenceLanguageAdapter;
}
