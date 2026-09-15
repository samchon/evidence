import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import { DocumentationExamples } from "../../parsers/DocumentationExamples";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IKotlinDocumentation } from "./IKotlinDocumentation";

/**
 * Reads KDoc while preserving source mappings and masking code examples.
 *
 * KDoc tags can acknowledge Evidence, whereas examples are prose and must not
 * create declarations despite containing text that resembles an annotation.
 */
export namespace KotlinDocumentation {
  /**
   * Maps a carrier and removes examples without moving source offsets.
   *
   * Only block KDoc receives Kotlin-specific masking; other classified carriers
   * retain EvidenceDocumentation's normalized text and source mapping unchanged.
   */
  export function read(
    source: IEvidenceSourceFile,
    documentation: IKotlinDocumentation,
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
   * Masks HTML examples and Markdown indented code before tag parsing.
   *
   * Fence handling remains in the shared tag parser because it depends on the
   * annotation grammar rather than Kotlin documentation syntax.
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
   * Tabs advance to their next four-column stop so mixed indentation follows the
   * same threshold used when identifying indented code examples.
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
   * Spaces prevent tags inside examples from parsing, and retained CR/LF bytes
   * preserve the offset mapping used for diagnostics outside those examples.
   */
  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
