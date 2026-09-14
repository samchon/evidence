import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IScalaDocumentation } from "./IScalaDocumentation";

/**
 * Reads Scaladoc while preserving source mappings and masking code examples.
 *
 * Evidence tag parsing receives the masked text so examples cannot create declarations, while original offsets remain valid for diagnostics and hosts.
 */
export namespace ScalaDocumentation {
  /**
   * Maps a classified documentation carrier and masks ineligible examples without moving offsets.
   *
   * Non-Scaladoc carriers retain the shared parser mapping unchanged because only Scaladoc supports example masking here.
   */
  export function read(
    source: IEvidenceSourceFile,
    documentation: IScalaDocumentation,
    hostId: string,
  ): IEvidenceDocumentation {
    const parsed = EvidenceDocumentation.read(
      source.content,
      hostId,
      documentation.range,
      documentation.syntax,
    );
    if (documentation.syntax.opening !== "/**") return parsed;
    return {
      ...parsed,
      text: mask(parsed.text),
    };
  }

  /**
   * Masks Scaladoc brace blocks, HTML code elements, and indented Markdown examples.
   *
   * Fenced examples are left for the shared tag parser, and replacement spaces preserve every unmasked source position.
   */
  function mask(input: string): string {
    const characters = input.split("");
    for (const match of input.matchAll(/\{\{\{[\s\S]*?(?:\}\}\}|$)/gu))
      hide(characters, match.index, match.index + match[0].length);
    const htmlCode = /<(pre|code)\b[^>]*>[\s\S]*?<\/\1\s*>/giu;
    for (const match of input.matchAll(htmlCode))
      hide(characters, match.index, match.index + match[0].length);
    const lines = input.split("\n");
    const indents = lines.filter((line) => line.trim() !== "").map(indentation);
    const baseline = indents.reduce(
      (minimum, indent) => Math.min(minimum, indent),
      Infinity,
    );
    let offset = 0;
    for (const line of lines) {
      if (indentation(line) >= baseline + 4)
        hide(characters, offset, offset + line.length);
      offset += line.length + 1;
    }
    return characters.join("");
  }

  /**
   * Counts a line's Markdown indentation after its documentation delimiter is removed.
   *
   * Tabs advance to the next four-column boundary so mixed indentation uses the same threshold as spaces.
   */
  function indentation(line: string): number {
    let spaces = 0;
    for (const character of line) {
      if (character === " ") ++spaces;
      else if (character === "\t") spaces += 4 - (spaces % 4);
      else break;
    }
    return spaces;
  }

  /**
   * Replaces example characters with spaces while retaining original line boundaries.
   *
   * Newline and carriage-return characters remain intact so ranges and line numbers continue to map to source.
   */
  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
