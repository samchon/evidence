import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import { EvidenceDocumentationExamples } from "../../parsers/EvidenceDocumentationExamples";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceMatlabDocumentation } from "./IEvidenceMatlabDocumentation";

/**
 * Reads MATLAB help while preserving source mappings and masking code examples.
 *
 * The MATLAB adapter supplies attached help carriers here before shared tag
 * parsing, preserving source coordinates while examples become ineligible
 * text.
 */
export namespace EvidenceMatlabDocumentation {
  /**
   * Maps a carrier and masks examples without moving source offsets.
   *
   * The resulting documentation retains its source mapping while annotations in
   * help examples cannot be parsed as Evidence declarations.
   */
  export function read(
    source: IEvidenceSourceFile,
    documentation: IEvidenceMatlabDocumentation,
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

  /**
   * Masks HTML examples and Markdown-indented code in MATLAB help text.
   *
   * Shared Evidence parsing handles fenced examples separately; this helper
   * only replaces content whose physical offsets must remain aligned with the
   * source.
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
   * `mask` uses the common indentation baseline to identify lines belonging to
   * an indented example without changing line lengths or coordinates.
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
   * Preserved newlines and character positions keep parsed tag offsets valid
   * for source diagnostics after the example text has been hidden.
   */
  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
