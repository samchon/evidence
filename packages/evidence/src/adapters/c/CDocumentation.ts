import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { ICDocumentation } from "./ICDocumentation";

/**
 * Reads C Doxygen documentation while masking embedded source examples.
 *
 * The C adapter uses this wrapper around the shared reader so Evidence tags in
 * code and preformatted examples cannot be mistaken for documentation claims.
 */
export namespace CDocumentation {
  export function read(
    source: IEvidenceSourceFile,
    documentation: ICDocumentation,
    hostId: string,
  ): IEvidenceDocumentation {
    const parsed = EvidenceDocumentation.read(
      source.content,
      hostId,
      documentation.range,
      documentation.syntax,
    );
    if (!documentation.syntax.allowWithdrawal) return parsed;
    return { ...parsed, text: mask(parsed.text) };
  }

  function mask(input: string): string {
    const characters = input.split("");
    for (const expression of [
      /<(code|pre)\b[^>]*>[\s\S]*?<\/\1\s*>/giu,
      /(?:@|\\)code\b[\s\S]*?(?:@|\\)endcode\b/giu,
    ])
      for (const match of input.matchAll(expression))
        hide(characters, match.index, match.index + match[0].length);
    return characters.join("");
  }

  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
