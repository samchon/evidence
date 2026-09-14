import type { Scalar } from "yaml";

import type { IYamlScalarMapping } from "./IYamlScalarMapping";
import { SourceText } from "../../internal/SourceText";

/** Maps a decoded YAML string scalar back to its original UTF-16 token. */
export namespace YamlScalarMapper {
  export function map(
    content: string,
    node: Scalar<string>,
  ): IYamlScalarMapping | undefined {
    const tuple = node.range;
    if (tuple === undefined || tuple === null) return undefined;
    const source = new SourceText(content);
    const range = source.range(tuple[0], tuple[1]);
    const text = node.value;
    const offsets: number[] = [];
    const ends: number[] = [];
    let cursor = tuple[0];
    let escapedStart = cursor;
    let escapedEnd = cursor;
    let escapedUnits = 0;
    if (node.type === "QUOTE_DOUBLE" || node.type === "QUOTE_SINGLE") ++cursor;
    for (let index = 0; index < text.length; ++index) {
      if (escapedUnits > 0) {
        offsets.push(escapedStart);
        ends.push(escapedEnd);
        escapedStart = escapedEnd;
        --escapedUnits;
        continue;
      }
      if (node.type === "QUOTE_DOUBLE" && content[cursor] === "\\") {
        const escape = escaped(content, cursor, tuple[1]);
        const unitEnd =
          escape[1] === 1
            ? escape[0]
            : cursor + Math.floor((escape[0] - cursor) / escape[1]);
        offsets.push(cursor);
        ends.push(unitEnd);
        escapedStart = unitEnd;
        escapedEnd = escape[0];
        escapedUnits = escape[1] - 1;
        cursor = escape[0];
        continue;
      }
      const found = content.indexOf(text[index] ?? "", cursor);
      if (found >= cursor && found < tuple[1]) {
        offsets.push(found);
        ends.push(found + 1);
        cursor = found + 1;
      } else {
        const start = Math.min(cursor, tuple[1]);
        const end = Math.min(start + 1, tuple[1]);
        offsets.push(start);
        ends.push(end);
        cursor = end;
      }
    }
    offsets.push(Math.min(cursor, tuple[1]));
    return { text, range, offsets, ends };
  }
}

function escaped(
  content: string,
  start: number,
  limit: number,
): [number, number] {
  const marker = content[start + 1];
  const length =
    marker === "x" ? 4 : marker === "u" ? 6 : marker === "U" ? 10 : 2;
  const end = Math.min(start + length, limit);
  if (marker !== "U") return [end, 1];
  const value = Number.parseInt(content.slice(start + 2, end), 16);
  return [end, Number.isFinite(value) && value > 0xffff ? 2 : 1];
}
