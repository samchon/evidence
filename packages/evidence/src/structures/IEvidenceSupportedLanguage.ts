import type { EvidenceProgrammingType } from "../typings/EvidenceProgrammingType";
import type { IEvidenceLanguageAdapter } from "./IEvidenceLanguageAdapter";
import type { IEvidenceLanguageGrammar } from "./IEvidenceLanguageGrammar";

/** One shipped programming adapter and its exact registry capabilities. */
export interface IEvidenceSupportedLanguage {
  type: EvidenceProgrammingType;
  name: string;
  grammars: IEvidenceLanguageGrammar[];
  adapter: IEvidenceLanguageAdapter;
}
