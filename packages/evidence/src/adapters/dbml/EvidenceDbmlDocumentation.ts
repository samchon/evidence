import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceDbmlDocumentation } from "./IEvidenceDbmlDocumentation";

/**
 * Decodes DBML note escapes without losing original UTF-16 annotation
 * positions.
 *
 * The adapter uses mapped positions to attach Evidence tags to original source
 * text.
 */
export namespace EvidenceDbmlDocumentation {
  /**
   * Reads established comment or note ownership and preserves mapped decoded
   * characters.
   *
   * Callers provide a scanner-created carrier after structural ownership is
   * known.
   */
  export function read(
    content: string,
    hostId: string,
    documentation: IEvidenceDbmlDocumentation,
  ): IEvidenceDocumentation {
    const parsed = EvidenceDocumentation.read(
      content,
      hostId,
      documentation.range,
      documentation.syntax,
    );
    if (!documentation.syntax.opening.startsWith("'")) return parsed;
    const offsets: number[] = [];
    const ends: number[] = [];
    let text = "";
    for (let index = 0; index < parsed.text.length; ++index) {
      let character = parsed.text[index] ?? "";
      const start = parsed.offsets[index];
      if (character === "\\" && index + 1 < parsed.text.length) {
        character = parsed.text[++index] ?? "";
        character =
          character === "n"
            ? "\n"
            : character === "r"
              ? "\r"
              : character === "t"
                ? "\t"
                : character;
      }
      const end = parsed.ends[index];
      if (start === undefined || end === undefined)
        throw new Error("A DBML note lost its original source mapping.");
      text += character;
      offsets.push(start);
      ends.push(end);
    }
    offsets.push(parsed.offsets.at(-1) ?? documentation.range.end.offset);
    return { ...parsed, text, offsets, ends };
  }
}
