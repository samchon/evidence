import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IJavaDocumentation } from "./IJavaDocumentation";

/**
 * Reads Javadoc while masking inline and preformatted code examples.
 *
 * The adapter preserves original source coordinates while removing example text
 * from tag parsing, so code-looking annotations cannot create evidence records.
 */
export namespace JavaDocumentation {
  export function read(
    source: IEvidenceSourceFile,
    documentation: IJavaDocumentation,
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

  function mask(input: string): string {
    const characters = input.split("");
    const htmlCode = /<(pre|code)\b[^>]*>[\s\S]*?<\/\1\s*>/giu;
    for (const match of input.matchAll(htmlCode))
      hide(characters, match.index, match.index + match[0].length);
    for (const opening of ["{@code", "{@literal", "{@snippet"])
      for (let index = input.indexOf(opening); index >= 0;) {
        const end = closingBrace(input, index);
        hide(characters, index, end);
        index = input.indexOf(opening, Math.max(end, index + opening.length));
      }
    return characters.join("");
  }

  function closingBrace(input: string, start: number): number {
    let depth = 0;
    for (let index = start; index < input.length; ++index) {
      const character = input[index];
      if (character === "{") ++depth;
      else if (character === "}" && --depth === 0) return index + 1;
    }
    return input.length;
  }

  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
