import { EvidDocumentation } from "../../parsers/EvidDocumentation";
import { EvidDocumentationExamples } from "../../parsers/EvidDocumentationExamples";
import type { IEvidDocumentation } from "../../structures/IEvidDocumentation";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidLuaDocumentation } from "./IEvidLuaDocumentation";

/**
 * Reads Lua documentation while preserving source mappings and masking
 * examples.
 *
 * EvidLuaFileScanner supplies classified carriers to this boundary, which
 * normalizes their text through the shared mapper and suppresses examples
 * before the tag parser can treat them as Evid annotations.
 */
export namespace EvidLuaDocumentation {
  /**
   * Maps one classified carrier into shared documentation data.
   *
   * Example text is replaced after shared parsing preserves original offsets,
   * so diagnostics and attachments still cite locations in the source file.
   */
  export function read(
    source: IEvidSourceFile,
    documentation: IEvidLuaDocumentation,
    hostId: string,
  ): IEvidDocumentation {
    const parsed = EvidDocumentation.read(
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

  /**
   * Masks HTML examples and Markdown-indented code in parsed documentation
   * text.
   *
   * Shared tag parsing already handles fenced code; this pass preserves all
   * line boundaries while removing other example regions from annotation
   * recognition.
   */
  function mask(input: string): string {
    const characters = input.split("");
    EvidDocumentationExamples.maskHtml(characters, input, ["pre", "code"]);
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
   * Counts visual Markdown indentation after documentation delimiters are
   * removed.
   *
   * Tabs advance to the next four-column boundary so indented-code detection
   * follows Markdown's column semantics instead of raw character count.
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
   * Replaces an example span with spaces while retaining line boundaries.
   *
   * Keeping newlines and carriage returns preserves offsets shared with the
   * original documentation carrier and prevents later source mappings from
   * drifting.
   */
  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
