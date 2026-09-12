import { EvidenceDocumentation } from "../EvidenceDocumentation";
import type { IEvidenceDocumentation } from "../structures/IEvidenceDocumentation";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { ICSharpDocumentation } from "./ICSharpDocumentation";

/** Reads C# XML documentation while masking code and example elements. */
export namespace CSharpDocumentation {
  export function read(
    source: IEvidenceSourceFile,
    documentation: ICSharpDocumentation,
    hostId: string,
  ): IEvidenceDocumentation {
    const parsed = EvidenceDocumentation.read(
      source.content,
      hostId,
      documentation.range,
      documentation.syntax,
    );
    if (!documentation.syntax.allowWithdrawal) return parsed;
    return {
      ...parsed,
      text: mask(parsed.text),
    };
  }

  function mask(input: string): string {
    const characters = input.split("");
    const examples = /<(c|code|example|pre)\b[^>]*>[\s\S]*?<\/\1\s*>/giu;
    for (const match of input.matchAll(examples))
      hide(characters, match.index, match.index + match[0].length);
    return characters.join("");
  }

  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
