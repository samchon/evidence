import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import { DocumentationExamples } from "../../parsers/DocumentationExamples";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { ISwiftDocumentation } from "./ISwiftDocumentation";

/**
 * Reads DocC while preserving source mappings and masking code examples.
 *
 * SwiftAdapter uses the normalized result for tag parsing after it establishes a
 * documentation host.
 */
export namespace SwiftDocumentation {
  /**
   * Maps a carrier and removes examples without moving source offsets.
   *
   * Preserved line positions let tag diagnostics map back to the original Swift source.
   */
  export function read(
    source: IEvidenceSourceFile,
    documentation: ISwiftDocumentation,
    hostId: string,
  ): IEvidenceDocumentation {
    const parsed = EvidenceDocumentation.read(
      source.content,
      hostId,
      documentation.range,
      documentation.syntax,
    );
    if (!["/**", "///"].includes(documentation.syntax.opening)) return parsed;
    return {
      ...parsed,
      text: mask(parsed.text),
    };
  }

  /**
   * Masks HTML examples and Markdown indented code before tag parsing.
   *
   * Example text cannot accidentally create Evidence annotations.
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
   * The value identifies code blocks relative to the least-indented prose line.
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
   * Keeping newlines intact preserves offsets for subsequent parsing and diagnostics.
   */
  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
