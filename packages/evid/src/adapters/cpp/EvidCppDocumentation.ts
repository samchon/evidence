import { EvidDocumentation } from "../../parsers/EvidDocumentation";
import { EvidDocumentationExamples } from "../../parsers/EvidDocumentationExamples";
import type { IEvidDocumentation } from "../../structures/IEvidDocumentation";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidCppDocumentation } from "./IEvidCppDocumentation";

/**
 * Reads C++ Doxygen documentation while masking embedded source examples.
 *
 * The C++ adapter delegates range mapping to the shared reader, then removes
 * example content so code-like Evid tags cannot create documentation claims.
 */
export namespace EvidCppDocumentation {
  /**
   * Maps one classified C++ documentation carrier for Evid tag parsing.
   *
   * Doxygen carriers preserve physical offsets while native and HTML code
   * regions become inert. Non-withdrawal comments retain the shared mapped text
   * directly.
   */
  export function read(
    source: IEvidSourceFile,
    documentation: IEvidCppDocumentation,
    hostId: string,
  ): IEvidDocumentation {
    const parsed = EvidDocumentation.read(
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
      EvidDocumentationExamples.markdownCode(input);
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
    EvidDocumentationExamples.maskHtml(characters, input, ["code", "pre"]);
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
