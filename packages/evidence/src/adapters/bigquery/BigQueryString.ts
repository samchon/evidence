import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";

/**
 * Decodes static GoogleSQL descriptions while retaining original UTF-16 coordinates.
 *
 * The BigQuery scanner uses these mappings when an OPTIONS description hosts annotations.
 */
export namespace BigQueryString {
  /**
   * Returns no mapping for unsupported byte strings, escapes, or concatenated expressions.
   *
   * A missing result makes the enclosing declaration incomplete instead of guessing offsets.
   */
  export function read(
    raw: string,
    start: number,
  ): IEvidenceDocumentation | undefined {
    const head = /^(r?)("""|'''|"|')/iu.exec(raw);
    if (head === null) return undefined;
    const delimiter = head[2];
    if (delimiter === undefined || !raw.endsWith(delimiter)) return undefined;
    const rawMode = (head[1] ?? "").toLowerCase() === "r";
    const end = raw.length - delimiter.length;
    let text = "";
    const offsets: number[] = [];
    const ends: number[] = [];
    for (let cursor = head[0].length; cursor < end;) {
      const from = cursor;
      let value = raw[cursor++] ?? "";
      if (value === "\\" && !rawMode) {
        const escape = raw[cursor++];
        const simple = escape === undefined ? undefined : ESCAPES.get(escape);
        if (simple !== undefined) value = simple;
        else if (escape === "u" || escape === "U" || escape === "x") {
          const width = escape === "U" ? 8 : escape === "u" ? 4 : 2;
          const digits = raw.slice(cursor, cursor + width);
          if (digits.length !== width || !/^[\da-f]+$/iu.test(digits))
            return undefined;
          const point = Number.parseInt(digits, 16);
          if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff))
            return undefined;
          value = String.fromCodePoint(point);
          cursor += width;
        } else return undefined;
      }
      if (cursor > end) return undefined;
      text += value;
      for (let index = 0; index < value.length; ++index) {
        offsets.push(start + from);
        ends.push(start + cursor);
      }
    }
    offsets.push(start + end);
    return {
      hostId: "",
      text,
      offsets,
      ends,
      tagBoundaries: true,
      allowWithdrawal: true,
    };
  }

  const ESCAPES = new Map<string, string>([
    ["n", "\n"],
    ["r", "\r"],
    ["t", "\t"],
    ["b", "\b"],
    ["f", "\f"],
    ["v", "\v"],
    ["a", "\x07"],
    ["\\", "\\"],
    ["'", "'"],
    ['"', '"'],
    ["?", "?"],
  ]);
}
