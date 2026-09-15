import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import { EvidenceDocumentationExamples } from "../../parsers/EvidenceDocumentationExamples";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceCDocumentation } from "./IEvidenceCDocumentation";

/**
 * Reads C Doxygen documentation while masking embedded source examples.
 *
 * The C adapter uses this wrapper around the shared reader so Evidence tags in
 * code and preformatted examples cannot be mistaken for documentation claims.
 */
export namespace EvidenceCDocumentation {
  /**
   * Maps one classified C documentation carrier for Evidence tag parsing.
   *
   * Withdrawal-capable Doxygen receives native and HTML example masking; other
   * comment forms retain the shared source mapping without that prose syntax.
   */
  export function read(
    source: IEvidenceSourceFile,
    documentation: IEvidenceCDocumentation,
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

  /**
   * Masks Markdown-aware Doxygen and HTML code regions in precedence order.
   *
   * Markdown code cannot open native state. Genuine native code is removed
   * before HTML pairing, and an unclosed native region owns the host
   * remainder.
   */
  function mask(input: string): string {
    const characters: string[] = input.split("");
    const markdown: readonly boolean[] =
      EvidenceDocumentationExamples.markdownCode(input);
    let opening: number | undefined;
    for (const match of input.matchAll(/(?:@|\\)(code|endcode)\b/giu)) {
      const index: number = match.index;
      const command: string = (match[1] ?? "").toLowerCase();
      if (opening === undefined) {
        if (command === "code" && markdown[index] !== true) opening = index;
      } else if (command === "endcode") {
        hide(characters, opening, index + match[0].length);
        opening = undefined;
      }
    }
    if (opening !== undefined) hide(characters, opening, input.length);
    EvidenceDocumentationExamples.maskHtml(characters, input, ["code", "pre"]);
    return characters.join("");
  }

  /**
   * Replaces a Doxygen example span while preserving mapped source positions.
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
