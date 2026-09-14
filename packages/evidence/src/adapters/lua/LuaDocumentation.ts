import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { ILuaDocumentation } from "./ILuaDocumentation";

/** Reads Lua documentation while preserving source mappings and masking code examples. */
export namespace LuaDocumentation {
  /** Maps a classified carrier and removes ineligible example text without moving offsets. */
  export function read(
    source: IEvidenceSourceFile,
    documentation: ILuaDocumentation,
    hostId: string,
  ): IEvidenceDocumentation {
    const parsed = EvidenceDocumentation.read(
      source.content,
      hostId,
      documentation.range,
      documentation.syntax,
    );
    return {
      ...parsed,
      text: mask(parsed.text),
    };
  }

  /** Masks HTML examples and Markdown indented code; shared tag parsing handles fences. */
  function mask(input: string): string {
    const characters = input.split("");
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

  /** Counts Markdown indentation after the documentation delimiter is removed. */
  function indentation(line: string): number {
    let spaces = 0;
    for (const character of line) {
      if (character === " ") ++spaces;
      else if (character === "\t") spaces += 4 - (spaces % 4);
      else break;
    }
    return spaces;
  }

  /** Replaces example characters with spaces while retaining original line boundaries. */
  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
