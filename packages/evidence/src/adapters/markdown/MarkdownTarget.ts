import type { IEvidenceAddress } from "../../structures/IEvidenceAddress";

/**
 * Parses one root-relative Markdown path and optional literal anchor.
 *
 * Target resolution uses this grammar for Markdown references, retaining the
 * anchor as one accessor segment because Markdown headings are not nested paths.
 */
export namespace MarkdownTarget {
  export function parse(target: string): IEvidenceAddress {
    const hash = target.indexOf("#");
    if (hash === target.length - 1)
      throw new Error(
        "Name a Markdown anchor after '#', or omit '#' when citing the file unit itself.",
      );
    const file = normalize(hash < 0 ? target : target.slice(0, hash));
    if (file === "") throw new Error("Name the Markdown file before '#'.");
    return {
      file,
      segments: hash < 0 ? [] : [target.slice(hash + 1)],
    };
  }

  /**
   * Preserves authored path text except portable separators and leading `./`.
   *
   * This makes equivalent relative spellings compare consistently without
   * resolving dot segments or changing the case-sensitive public file address.
   */
  export function normalize(file: string): string {
    let output = file.replaceAll("\\", "/");
    while (output.startsWith("./")) output = output.slice(2);
    return output;
  }
}
