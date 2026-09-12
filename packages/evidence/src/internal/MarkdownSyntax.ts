import type { EvidenceMarkdownSymbol } from "../typings/EvidenceMarkdownSymbol";
import type { EvidenceMarkdownRenderedEdge } from "./EvidenceMarkdownRenderedEdge";
import type { IMarkdownFence } from "./IMarkdownFence";
import type { IMarkdownHeading } from "./IMarkdownHeading";

/** Markdown syntax shared by unit materialization and unreadable-tag diagnostics. */
export namespace MarkdownSyntax {
  const explicitAnchor = /\s*\{#([A-Za-z0-9][A-Za-z0-9._:-]*)\}\s*$/;
  const letterOrNumber = /^(?:\p{L}|\p{N})$/u;
  const markers = [
    "@evidenceExcludeReview",
    "@evidenceReview",
    "@evidenceExclude",
    "@evidence",
    "@link",
  ];

  export function fence(line: string): IMarkdownFence | undefined {
    let indent = 0;
    while (indent < line.length && line[indent] === " ") ++indent;
    if (indent > 3) return undefined;
    const marker = line[indent];
    if (marker !== "`" && marker !== "~") return undefined;
    let cursor = indent;
    while (line[cursor] === marker) ++cursor;
    const length = cursor - indent;
    if (length < 3) return undefined;
    const remainder = line.slice(cursor);
    if (marker === "`" && remainder.includes("`")) return undefined;
    return { marker, length, remainder };
  }

  export function heading(line: string): IMarkdownHeading | undefined {
    let cursor = 0;
    while (cursor < line.length && line[cursor] === " " && cursor < 4) ++cursor;
    if (cursor > 3 || line[cursor] !== "#") return undefined;
    const marker = cursor;
    while (line[cursor] === "#") ++cursor;
    const level = cursor - marker;
    if (level > 6) return undefined;
    if (cursor < line.length && line[cursor] !== " " && line[cursor] !== "\t")
      return undefined;
    let title = line.slice(cursor).trim();
    const withoutHashes = title.replace(/#+$/, "");
    if (
      withoutHashes !== title &&
      (withoutHashes === "" ||
        withoutHashes.endsWith(" ") ||
        withoutHashes.endsWith("\t"))
    )
      title = withoutHashes.trim();
    const match = explicitAnchor.exec(title);
    if (match !== null) {
      const anchor = match[1];
      if (anchor !== undefined)
        return {
          level,
          title: title.slice(0, match.index).trim(),
          anchor,
        };
    }
    return { level, title, anchor: slug(title) };
  }

  export function slug(title: string): string {
    let output = "";
    let separated = false;
    for (const character of title.toLowerCase()) {
      if (letterOrNumber.test(character) || character === "_") {
        output += character;
        separated = false;
      } else if (
        (character === "-" || character.trim() === "") &&
        output !== "" &&
        !separated
      ) {
        output += "-";
        separated = true;
      }
    }
    return output.replace(/-$/, "");
  }

  export function annotation(line: string): string | undefined {
    const content = lineContent(line);
    return markers.find(
      (marker) =>
        content === marker ||
        content.startsWith(marker + " ") ||
        content.startsWith(marker + "\t"),
    );
  }

  export function lineContent(line: string): string {
    let content = line.trim();
    let changed = true;
    while (changed) {
      changed = false;
      if (content.startsWith(">")) {
        content = content.slice(1).trim();
        changed = true;
        continue;
      }
      const marker = listMarker(content);
      if (marker !== 0) {
        content = content.slice(marker).trim();
        changed = true;
      }
    }
    return content;
  }

  export function renderedEdge(line: string): EvidenceMarkdownRenderedEdge {
    const lower = line.toLowerCase();
    if (lower.includes("<pre"))
      return lower.includes("</pre>") ? "both" : "open";
    if (lower.includes("</pre>")) return "close";
    if (line.includes("={`")) return line.includes("`}") ? "both" : "open";
    if (line.includes("`}")) return "close";
    return "none";
  }

  export function indentedCode(line: string): boolean {
    return line.startsWith("    ") || line.startsWith("\t");
  }

  /** Returns whether one column lies inside a closed backtick code span. */
  export function inlineCode(line: string, column: number): boolean {
    let cursor = 0;
    while (cursor < line.length) {
      const opening = line.indexOf("`", cursor);
      if (opening < 0) return false;
      const length = delimiterLength(line, opening);
      if (escaped(line, opening)) {
        cursor = opening + length;
        continue;
      }
      let closing = opening + length;
      let closed = false;
      while (closing < line.length) {
        closing = line.indexOf("`", closing);
        if (closing < 0) return false;
        const candidate = delimiterLength(line, closing);
        if (candidate === length && !escaped(line, closing)) {
          closed = true;
          break;
        }
        closing += candidate;
      }
      if (!closed) return false;
      if (column >= opening && column < closing + length) return true;
      cursor = closing + length;
    }
    return false;
  }

  export function hasWhitespace(value: string): boolean {
    for (const character of value) if (character.trim() === "") return true;
    return false;
  }

  /** Maps one supported ATX depth to its public Markdown selector. */
  export function symbol(level: number): EvidenceMarkdownSymbol {
    switch (level) {
      case 1:
        return "h1";
      case 2:
        return "h2";
      case 3:
        return "h3";
      case 4:
        return "h4";
      default:
        throw new Error(`Markdown H${level} is not an Evidence unit.`);
    }
  }

  function listMarker(content: string): number {
    for (const marker of ["- ", "* ", "+ "])
      if (content.startsWith(marker)) return marker.length;
    let cursor = 0;
    while (cursor < content.length) {
      const character = content[cursor];
      if (character === undefined || character < "0" || character > "9") break;
      ++cursor;
    }
    if (
      cursor === 0 ||
      cursor + 1 >= content.length ||
      (content[cursor] !== "." && content[cursor] !== ")") ||
      content[cursor + 1] !== " "
    )
      return 0;
    return cursor + 2;
  }

  function delimiterLength(line: string, opening: number): number {
    let cursor = opening;
    while (line[cursor] === "`") ++cursor;
    return cursor - opening;
  }

  function escaped(line: string, offset: number): boolean {
    let slashes = 0;
    for (let index = offset - 1; index >= 0 && line[index] === "\\"; --index)
      ++slashes;
    return slashes % 2 === 1;
  }
}
