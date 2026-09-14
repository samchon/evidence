import type { IEvidenceSupportedDatabaseLanguage } from "./IEvidenceSupportedDatabaseLanguage";
import type { IEvidenceSupportedLanguage } from "./IEvidenceSupportedLanguage";

/** Versioned result emitted by `evidence languages`. */
export interface IEvidenceLanguagesReport {
  schemaVersion: 1;
  command: "languages";
  total: number;
  languages: (
    IEvidenceSupportedLanguage | IEvidenceSupportedDatabaseLanguage
  )[];
}
