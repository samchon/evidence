import { EvidDocumentation } from "../../parsers/EvidDocumentation";
import { EvidDocumentationExamples } from "../../parsers/EvidDocumentationExamples";
import type { IEvidDocumentation } from "../../structures/IEvidDocumentation";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidScalaDocumentation } from "./IEvidScalaDocumentation";

/**
 * Reads Scaladoc while preserving source mappings and masking code examples.
 *
 * Evid tag parsing receives the masked text so examples cannot create
 * declarations, while original offsets remain valid for diagnostics and hosts.
 */
export namespace EvidScalaDocumentation {
  /**
   * Maps a documentation carrier and masks examples without moving source offsets.
   *
   * Non-Scaladoc carriers retain the shared parser mapping unchanged because only
   * Scaladoc supports example masking here.
   */
  export function read(
    source: IEvidSourceFile,
    documentation: IEvidScalaDocumentation,
    hostId: string,
  ): IEvidDocumentation {
    const parsed = EvidDocumentation.read(
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
   * Masks Scaladoc brace blocks, HTML code, and indented Markdown examples.
   *
   * Fenced examples remain for the shared tag parser, and replacement spaces
   * preserve every unmasked source position.
   */
  function mask(input: string): string {
    const characters: string[] = input.split("");
    const markdown: readonly boolean[] =
      EvidDocumentationExamples.markdownCode(input);
    let opening: number | undefined;
    for (const match of input.matchAll(/\{\{\{|\}\}\}/gu)) {
      const index: number = match.index;
      if (opening === undefined) {
        if (match[0] === "{{{" && markdown[index] !== true) opening = index;
      } else if (match[0] === "}}}") {
        hide(characters, opening, index + match[0].length);
        opening = undefined;
      }
    }
    if (opening !== undefined) hide(characters, opening, input.length);
    EvidDocumentationExamples.maskHtml(characters, input, ["pre", "code"]);
    const lines: string[] = input.split("\n");
    const indents: number[] = lines
      .filter((line: string): boolean => line.trim() !== "")
      .map((line: string): number => indentation(line));
    const baseline: number = indents.reduce(
      (minimum: number, indent: number): number => Math.min(minimum, indent),
      Infinity,
    );
    let offset: number = 0;
    for (const line of lines) {
      if (indentation(line) >= baseline + 4)
        hide(characters, offset, offset + line.length);
      offset += line.length + 1;
    }
    return characters.join("");
  }

  /**
   * Counts indentation after the documentation delimiter is removed.
   *
   * Tabs advance to the next four-column boundary so mixed indentation uses the
   * same threshold as spaces.
   */
  function indentation(line: string): number {
    let spaces: number = 0;
    for (const character of line) {
      if (character === " ") ++spaces;
      else if (character === "\t") spaces += 4 - (spaces % 4);
      else break;
    }
    return spaces;
  }

  /**
   * Replaces example characters while retaining original line boundaries.
   *
   * Newline and carriage-return characters remain intact so ranges and line
   * numbers continue to map to source.
   */
  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
