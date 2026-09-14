import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";

/** Decoded YAML scalar with monotonic positions in its source token.
 *
 * Documentation handling uses the maps to convert decoded annotation offsets
 * back to the UTF-16 positions that users can edit.
 */
export interface IYamlScalarMapping {
  /** Decoded scalar text inspected for Evidence annotations. */
  text: string;

  /** Complete scalar token span in the original document. */
  range: IEvidenceSourceRange;

  /** Source start offsets indexed by decoded UTF-16 code unit. */
  offsets: number[];

  /** Source end offsets paired with `offsets` entries. */
  ends: number[];
}
