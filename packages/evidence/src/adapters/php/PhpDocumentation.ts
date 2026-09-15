import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import { DocumentationExamples } from "../../parsers/DocumentationExamples";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IPhpDocumentation } from "./IPhpDocumentation";

/**
 * Reads PHPDoc while preserving source mappings and masking code examples.
 *
 * The PHP adapter supplies attached carriers here before shared tag parsing, so
 * diagnostics retain their original source positions after examples are hidden.
 */
export namespace PhpDocumentation {
  /**
   * Maps a carrier and removes examples without moving source offsets.
   *
   * The returned documentation keeps the shared parser's coordinates while its
   * masked text prevents annotations in PHPDoc examples from becoming evidence.
   */
  export function read(
    source: IEvidenceSourceFile,
    documentation: IPhpDocumentation,
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
   * Masks HTML examples and Markdown-indented code in parsed PHPDoc text.
   *
   * Fenced regions remain the shared tag parser's responsibility; this helper
   * only removes examples whose characters must retain their mapped offsets.
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
   * `mask` uses the result to establish the common indentation baseline before
   * recognizing lines that belong to an indented code example.
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
   * Preserved length and newlines keep offsets from `EvidenceDocumentation` valid
   * for diagnostics and source-range attachment after masking.
   */
  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
