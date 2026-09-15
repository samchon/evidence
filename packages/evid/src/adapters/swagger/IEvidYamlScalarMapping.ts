import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";

/**
 * Decoded YAML scalar with monotonic positions in its source token.
 *
 * Documentation handling uses the maps to convert decoded annotation offsets
 * back to the UTF-16 positions that users can edit.
 */
export interface IEvidYamlScalarMapping {
  /**
   * Decoded scalar text inspected for Evid annotations.
   *
   * Annotation parsing uses this value while `offsets` and `ends` translate its
   * decoded UTF-16 positions back into the original YAML source token.
   */
  text: string;

  /**
   * Complete scalar token span in the original document.
   *
   * This range bounds every decoded-offset mapping and supplies the source
   * location when a YAML scalar's annotation needs a diagnostic.
   */
  range: IEvidSourceRange;

  /**
   * Source start offsets indexed by decoded UTF-16 code unit.
   *
   * Each entry identifies where the corresponding decoded unit begins,
   * including escape sequences that occupy a wider physical spelling in the
   * document.
   */
  offsets: number[];

  /**
   * Source end offsets paired with `offsets` entries.
   *
   * The matching interval permits annotation spans to include an entire escape
   * spelling rather than pointing into only part of one YAML scalar token.
   */
  ends: number[];
}
