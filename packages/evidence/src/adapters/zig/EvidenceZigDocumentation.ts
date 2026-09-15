import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import { EvidenceDocumentationExamples } from "../../parsers/EvidenceDocumentationExamples";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceZigDocumentation } from "./IEvidenceZigDocumentation";

/**
 * Reads Zig documentation while preserving source mappings and masking
 * examples.
 *
 * EvidenceZigAdapter uses this reader so annotations in HTML or indented code
 * examples cannot become claims at the original source host.
 */
export namespace EvidenceZigDocumentation {
  /**
   * Maps one carrier and removes examples without moving source offsets.
   *
   * Only triple-slash documentation is masked because other carrier forms exist
   * solely to report unsupported tag-bearing source text with its original
   * mapping.
   */
  export function read(
    source: IEvidenceSourceFile,
    documentation: IEvidenceZigDocumentation,
    hostId: string,
  ): IEvidenceDocumentation {
    const parsed = EvidenceDocumentation.read(
      source.content,
      hostId,
      documentation.range,
      documentation.syntax,
    );
    if (documentation.syntax.opening !== "///") return parsed;
    return {
      ...parsed,
      text: mask(parsed.text),
    };
  }

  /**
   * Masks HTML examples and Markdown indented code in mapped documentation
   * text.
   *
   * Fenced code remains the shared tag parser's responsibility, while this pass
   * preserves offsets by replacing example characters with spaces.
   */
  function mask(input: string): string {
    const characters = input.split("");
    EvidenceDocumentationExamples.maskHtml(characters, input, ["pre", "code"]);
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
   * Tab stops advance to four-column boundaries so indented example detection
   * matches Markdown's visual indentation rule for the mapped text.
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
   * Keeping line endings intact preserves evidence tag offsets and diagnostics
   * relative to the original source documentation carrier.
   */
  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
