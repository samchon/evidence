import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";

/** Decoded YAML scalar with monotonic positions in its source token. */
export interface IYamlScalarMapping {
  text: string;
  range: IEvidenceSourceRange;
  offsets: number[];
  ends: number[];
}
