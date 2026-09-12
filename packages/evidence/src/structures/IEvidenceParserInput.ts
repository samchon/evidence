import type { EvidenceProgrammingType } from "../typings/EvidenceProgrammingType";

/** One selected source address and its decoded snapshot contents. */
export interface IEvidenceParserInput {
  type: EvidenceProgrammingType;
  /** Logical file name selects syntax variants, even when the physical file has another name. */
  file: string;
  content: string;
}
