import type { EvidenceGrammarWasmAvailability } from "../typings/EvidenceGrammarWasmAvailability";
import type { EvidenceLanguageCandidateId } from "../typings/EvidenceLanguageCandidateId";
import type { EvidenceLanguageCandidateKind } from "../typings/EvidenceLanguageCandidateKind";

/** Researched grammar and semantic work that does not yet constitute language support. */
export interface IEvidenceLanguageCandidate {
  id: EvidenceLanguageCandidateId;
  name: string;
  kind: EvidenceLanguageCandidateKind;
  dialects: string[];
  grammarRepository: string;
  grammarLicense: string;
  wasm: EvidenceGrammarWasmAvailability;
  wasmNotes: string;
  languageReference: string;
  visibility: string;
  declarations: string;
  blockers: string[];
  next: string;
}
