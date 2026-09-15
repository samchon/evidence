import { EvidDocumentation } from "../../parsers/EvidDocumentation";
import { EvidDocumentationExamples } from "../../parsers/EvidDocumentationExamples";
import type { IEvidDocumentation } from "../../structures/IEvidDocumentation";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidCSharpDocumentation } from "./IEvidCSharpDocumentation";

/**
 * Reads C# XML documentation while masking code and example elements.
 *
 * The C# adapter retains mapped prose from the shared reader but hides example
 * content so its code-like text cannot be interpreted as Evid annotations.
 */
export namespace EvidCSharpDocumentation {
  /**
   * Maps one C# XML documentation carrier and removes its example elements.
   *
   * Character replacement keeps the shared source offsets intact while
   * preventing tags inside `c`, `code`, `example`, or `pre` content from
   * becoming evidence.
   */
  export function read(
    source: IEvidSourceFile,
    documentation: IEvidCSharpDocumentation,
    hostId: string,
  ): IEvidDocumentation {
    const parsed = EvidDocumentation.read(
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

  /**
   * Masks supported XML documentation elements without moving source offsets.
   *
   * The shared helper owns Markdown, HTML comment, nesting, and unclosed-region
   * precedence for all four C# example element names. XML mode keeps a true
   * self-closing element from consuming the annotation that follows it.
   */
  function mask(input: string): string {
    const characters = input.split("");
    EvidDocumentationExamples.maskHtml(
      characters,
      input,
      ["c", "code", "example", "pre"],
      true,
    );
    return characters.join("");
  }
}
