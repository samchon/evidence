import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";

/** Maps an attached MySQL COMMENT literal without losing original UTF-16 positions. */
export namespace MysqlDocumentation {
  /** Decodes SQL doubled quotes; backslash escapes require server mode and are rejected. */
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
