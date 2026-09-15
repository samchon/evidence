import type { EvidMarkdownSymbol } from "../../typings/EvidMarkdownSymbol";
import type { IEvidMarkdownFence } from "./IEvidMarkdownFence";
import type { IEvidMarkdownHeading } from "./IEvidMarkdownHeading";

/**
 * Markdown syntax shared by unit materialization and unreadable-tag diagnostics.
 *
 * The Markdown adapter uses these lexical helpers before it creates units or
 * reports annotations that appear in non-readable source regions.
 */
export namespace EvidMarkdownSyntax {
  const explicitAnchor = /\s*\{#([A-Za-z0-9][A-Za-z0-9._:-]*)\}\s*$/;
  const letterOrNumber = /^(?:\p{L}|\p{N})$/u;
  const markers = [
    "@evidenceExcludeReview",
    "@evidenceReview",
    "@evidenceExclude",
    "@evidence",
    "@link",
  ];

  /**
   * Recognizes a CommonMark fenced-code boundary on one source line.
   *
   * Up to three leading spaces are allowed. The returned marker, run length,
   * and remainder let the scanner apply the opening and closing rules without
   * discarding the line's original spelling.
   */
  export function fence(line: string): IEvidMarkdownFence | undefined {
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

  /**
   * Parses one supported ATX heading and its stable anchor identity.
   *
   * Explicit `{#anchor}` suffixes win over generated slugs. Unsupported depth,
   * indentation, or missing marker separation leaves the line as ordinary prose.
   */
  export function heading(line: string): IEvidMarkdownHeading | undefined {
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

  /**
   * Derives Evid's deterministic anchor for an unanchored heading title.
   *
   * Letters, numbers, and underscores remain significant; punctuation and
   * whitespace collapse only into the hyphen separators admitted by this adapter.
   */
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

  /**
   * Finds a supported Evid marker after Markdown container prefixes.
   *
   * The marker must occupy the complete line or be followed by whitespace, so a
   * longer prose token cannot be misreported as an unreadable annotation.
   */
  export function annotation(line: string): string | undefined {
    const content = lineContent(line);
    return markers.find(
      (marker) =>
        content === marker ||
        content.startsWith(marker + " ") ||
        content.startsWith(marker + "\t"),
    );
  }

  /**
   * Removes repeated blockquote and list prefixes from one annotation line.
   *
   * Tag recognition consumes this logical content while source ranges continue
   * to use the unchanged physical line owned by the scanner.
   */
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

  /**
   * Reports whether one physical line belongs to an indented code block.
   *
   * Four spaces or one leading tab make headings and annotation syntax inert at
   * the top-level Markdown boundary supported by this scanner.
   */
  export function indentedCode(line: string): boolean {
    return line.startsWith("    ") || line.startsWith("\t");
  }

  /**
   * Reports whether a column lies inside a closed backtick code span.
   *
   * Annotation scanning uses this result to reject tags in inline examples while
   * ignoring unmatched delimiters that do not establish a Markdown code region.
   */
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

  /**
   * Detects whitespace that prevents a path from forming one target token.
   *
   * Markdown public addresses preserve literal path spelling, so callers reject
   * any Unicode whitespace instead of silently escaping or normalizing it.
   */
  export function hasWhitespace(value: string): boolean {
    for (const character of value) if (character.trim() === "") return true;
    return false;
  }

  /**
   * Maps one supported ATX depth to its public Markdown selector.
   *
   * Only headings that Evid materializes as units have selectors; other
   * depths fail here instead of silently receiving a public symbol.
   */
  export function symbol(level: number): EvidMarkdownSymbol {
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
        throw new Error(`Markdown H${level} is not an Evid unit.`);
    }
  }

  /**
   * Measures one supported Markdown list prefix at the start of logical text.
   *
   * Annotation parsing removes bullet and ordered-list containers repeatedly;
   * zero means the current text begins with neither supported form.
   */
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

  /**
   * Measures one contiguous backtick run from its opening column.
   *
   * Inline spans close only with a run of the same length, so the caller uses
   * this value both for comparison and for advancing beyond a delimiter.
   */
  function delimiterLength(line: string, opening: number): number {
    let cursor = opening;
    while (line[cursor] === "`") ++cursor;
    return cursor - opening;
  }

  /**
   * Reports whether Markdown backslash escaping neutralizes a token boundary.
   *
   * An odd immediately preceding slash run escapes the next punctuation token;
   * an even run represents literal slashes and leaves that token active.
   */
  export function escaped(line: string, offset: number): boolean {
    let slashes = 0;
    for (let index = offset - 1; index >= 0 && line[index] === "\\"; --index)
      ++slashes;
    return slashes % 2 === 1;
  }
}
