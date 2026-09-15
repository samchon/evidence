import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import { EvidenceDocumentationExamples } from "../../parsers/EvidenceDocumentationExamples";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceCSharpDocumentation } from "./IEvidenceCSharpDocumentation";

/**
 * Reads C# XML documentation while masking code and example elements.
 *
 * The C# adapter retains mapped prose from the shared reader but hides example
 * content so its code-like text cannot be interpreted as Evidence annotations.
 */
export namespace EvidenceCSharpDocumentation {
  /**
   * Maps one C# XML documentation carrier and removes its example elements.
   *
   * Character replacement keeps the shared source offsets intact while
   * preventing tags inside `c`, `code`, `example`, or `pre` content from
   * becoming evidence.
   */
  export function read(
    source: IEvidenceSourceFile,
    documentation: IEvidenceCSharpDocumentation,
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

  /**
   * Masks supported XML documentation elements without moving source offsets.
   *
   * The shared helper owns Markdown, HTML comment, nesting, and unclosed-region
   * precedence for all four C# example element names. XML mode keeps a true
   * self-closing element from consuming the annotation that follows it.
   */
  function mask(input: string): string {
    const characters = input.split("");
    EvidenceDocumentationExamples.maskHtml(
      characters,
      input,
      ["c", "code", "example", "pre"],
      true,
    );
    return characters.join("");
  }
}
