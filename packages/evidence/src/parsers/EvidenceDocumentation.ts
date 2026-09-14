import { SourceText } from "../internal/SourceText";
import type { IEvidenceCommentSyntax } from "../structures/IEvidenceCommentSyntax";
import type { IEvidenceDocumentation } from "../structures/IEvidenceDocumentation";
import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";

/**
 * Normalizes adapter-identified comments without losing source coordinates.
 *
 * The adapter owns comment classification and attachment. This helper only removes
 * the supplied delimiters and line prefixes, retaining mappings that let the tag
 * parser report exact spans and exclude accepted annotations from fingerprints.
 */
export namespace EvidenceDocumentation {
  /**
   * Reads a validated comment span into mapped annotation text.
   *
   * The range must belong to the supplied content and match the declared opening
   * and closing delimiters. Invalid spans throw instead of mapping unrelated text.
   * Adapters must establish comment identity and declaration ownership beforehand.
   */
  export function read(
    content: string,
    hostId: string,
    range: IEvidenceSourceRange,
    syntax: IEvidenceCommentSyntax,
  ): IEvidenceDocumentation {
    if (!new SourceText(content).contains(range))
      throw new Error("The documentation range does not match the source.");
    const raw = content.slice(range.start.offset, range.end.offset);
    if (
      raw.length < syntax.opening.length + syntax.closing.length ||
      !raw.startsWith(syntax.opening) ||
      !raw.endsWith(syntax.closing)
    )
      throw new Error(
        "The documentation delimiters do not match the adapter's comment span.",
      );
    const start = range.start.offset + syntax.opening.length;
    const end = range.end.offset - syntax.closing.length;
    let text = "";
    const offsets: number[] = [];
    const ends: number[] = [];
    let cursor = start;
    while (cursor < end) {
      const newline = content.indexOf("\n", cursor);
      const until = newline < 0 || newline >= end ? end : newline;
      let from = cursor;
      const prefix = syntax.linePrefix;
      if (prefix !== undefined && prefix !== "") {
        while (
          from < until &&
          (content[from] === " " || content[from] === "\t")
        )
          ++from;
        if (content.startsWith(prefix, from)) from += prefix.length;
        else from = cursor;
      }
      // Normalize CRLF for tag scanning while mapping the retained newline to
      // its original LF. Prefix removal must not shift diagnostic coordinates.
      const lineEnd = content[until - 1] === "\r" ? until - 1 : until;
      for (let index = from; index < lineEnd; ++index) {
        text += content[index] ?? "";
        offsets.push(index);
        ends.push(index + 1);
      }
      if (until < end) {
        text += "\n";
        offsets.push(until);
        ends.push(until + 1);
      }
      cursor = until + 1;
    }
    // Positions at normalized EOF still need an original source boundary even
    // when no text character remains after removing the closing delimiter.
    offsets.push(end);
    return {
      hostId,
      text,
      offsets,
      ends,
      tagBoundaries: syntax.tagBoundaries,
      allowWithdrawal: syntax.allowWithdrawal,
    };
  }
}
