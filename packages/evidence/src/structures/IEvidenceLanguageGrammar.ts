/** Case-sensitive file spellings accepted by one programming-language grammar. */
export interface IEvidenceLanguageGrammar {
  /** Identifies a pinned entry in the packaged grammar manifest. */
  id: string;
  extensions: string[];
  filenames: string[];
}
