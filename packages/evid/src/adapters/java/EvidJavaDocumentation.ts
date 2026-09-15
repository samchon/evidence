import { EvidDocumentation } from "../../parsers/EvidDocumentation";
import { EvidDocumentationExamples } from "../../parsers/EvidDocumentationExamples";
import type { IEvidDocumentation } from "../../structures/IEvidDocumentation";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidJavaDocumentation } from "./IEvidJavaDocumentation";

/**
 * Reads Javadoc while masking inline and preformatted code examples.
 *
 * The adapter preserves original source coordinates while removing example text
 * from tag parsing, so code-looking annotations cannot create evidence
 * records.
 */
export namespace EvidJavaDocumentation {
  /**
   * Maps one Java documentation carrier and removes its code examples.
   *
   * Javadoc applies native inline-tag precedence before HTML pairing. Other
   * Java comment forms retain their shared mapping because they do not own this
   * syntax.
   */
  export function read(
    source: IEvidSourceFile,
    documentation: IEvidJavaDocumentation,
    hostId: string,
  ): IEvidDocumentation {
    const parsed = EvidDocumentation.read(
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
   * Masks native Javadoc and HTML examples without changing mapped coordinates.
   *
   * Inline tags are hidden before HTML pairing so their literal markup cannot
   * consume ordinary documentation between two separate examples.
   */
  function mask(input: string): string {
    const characters: string[] = input.split("");
    const markdown: readonly boolean[] =
      EvidDocumentationExamples.markdownCode(input);
    const openings: string[] = ["{@code", "{@literal", "{@snippet"];
    for (const opening of openings)
      for (let index: number = input.indexOf(opening); index >= 0;) {
        if (markdown[index] === true) {
          index = input.indexOf(opening, index + opening.length);
          continue;
        }
        const end: number = closingBrace(input, index);
        hide(characters, index, end);
        index = input.indexOf(opening, Math.max(end, index + opening.length));
      }
    EvidDocumentationExamples.maskHtml(characters, input, ["pre", "code"]);
    return characters.join("");
  }

  /**
   * Finds the balanced end of one native Javadoc inline example.
   *
   * Nested braces belong to the inline body. An unmatched opening owns the rest
   * of the documentation carrier so its contents cannot become annotations.
   */
  function closingBrace(input: string, start: number): number {
    let depth: number = 0;
    for (let index: number = start; index < input.length; ++index) {
      const character: string | undefined = input[index];
      if (character === "{") ++depth;
      else if (character === "}" && --depth === 0) return index + 1;
    }
    return input.length;
  }

  /**
   * Replaces a Javadoc example span while preserving mapped source positions.
   *
   * Newline bytes remain intact so annotations after the example retain their
   * original diagnostic and host ranges.
   */
  function hide(characters: string[], start: number, end: number): void {
    for (let index = start; index < end; ++index)
      if (characters[index] !== "\n" && characters[index] !== "\r")
        characters[index] = " ";
  }
}
