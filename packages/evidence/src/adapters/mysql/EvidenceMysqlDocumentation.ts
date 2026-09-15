import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";

/**
 * Maps an attached MySQL COMMENT literal without losing original UTF-16
 * positions.
 *
 * The MySQL scanner supplies the literal range after it has established
 * ownership.
 */
export namespace EvidenceMysqlDocumentation {
  /**
   * Decodes SQL doubled quotes while rejecting server-mode-dependent backslash
   * escapes.
   *
   * Rejection avoids assigning annotation offsets under an unknown MySQL
   * session mode.
   */
  export function read(
    content: string,
    range: IEvidenceSourceRange,
    hostId: string,
  ): IEvidenceDocumentation | undefined {
    const raw = content.slice(range.start.offset, range.end.offset);
    if (!/^'(?:[^'\\]|'')*'$/su.test(raw)) return undefined;
    const result: IEvidenceDocumentation = {
      hostId,
      text: "",
      offsets: [],
      ends: [],
      tagBoundaries: true,
      allowWithdrawal: true,
    };
    for (
      let cursor = range.start.offset + 1;
      cursor < range.end.offset - 1;
      ++cursor
    ) {
      const character = content[cursor] ?? "";
      result.text += character;
      result.offsets.push(cursor);
      if (character === "'" && content[cursor + 1] === "'") ++cursor;
      result.ends.push(cursor + 1);
    }
    result.offsets.push(range.end.offset - 1);
    return result;
  }
}
