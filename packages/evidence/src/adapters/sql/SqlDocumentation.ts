import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import { DocumentationExamples } from "../../parsers/DocumentationExamples";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { ISqlDocumentation } from "./ISqlDocumentation";

/**
 * Reads SQL documentation while preserving source mappings and masking code
 * examples.
 *
 * Shared SQL adapters use the result before passing supported annotations to the
 * tag parser.
 */
export namespace SqlDocumentation {
  /**
   * Maps a carrier and removes examples without moving source offsets.
   *
   * Preserved offsets keep tag diagnostics aligned with the original SQL source.
   */
  export function read(
    source: IEvidenceSourceFile,
    documentation: ISqlDocumentation,
    hostId: string,
  ): IEvidenceDocumentation {
    if (documentation.mapped !== undefined)
      return {
        ...documentation.mapped,
        hostId,
        text: mask(documentation.mapped.text),
      };
    const raw = source.content.slice(
      documentation.range.start.offset,
      documentation.range.end.offset,
    );
    const syntax = documentation.syntax ?? {
      opening: raw.startsWith("--")
        ? "--"
        : raw.startsWith("/**")
          ? "/**"
          : "/*",
      closing: raw.startsWith("--") ? "" : "*/",
      linePrefix: raw.startsWith("--") ? "--" : "*",
      tagBoundaries: false,
      allowWithdrawal: true,
    };
    const parsed = EvidenceDocumentation.read(
      source.content,
      hostId,
      documentation.range,
      syntax,
    );
    return {
      ...parsed,
      text: mask(parsed.text),
    };
  }

  /**
   * Masks HTML examples and Markdown indented code before tag parsing.
   *
   * Masking replaces only visible characters so source line and UTF-16 positions
   * remain stable.
   */
  function mask(input: string): string {
    const characters = input.split("");
    DocumentationExamples.maskHtml(characters, input, ["pre", "code"]);
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
   * Counts Markdown indentation after the documentation delimiter is removed.
   *
   * Tabs advance to the next four-column boundary before code-block comparison.
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
   * Replaces example characters while retaining original line boundaries.
   *
   * Newlines remain intact so later offset mapping still identifies the source
   * carrier.
   */
  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
