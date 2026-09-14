import { SourceText } from "../internal/SourceText";
import type { IEvidenceCommentSyntax } from "../structures/IEvidenceCommentSyntax";
import type { IEvidenceDocumentation } from "../structures/IEvidenceDocumentation";
import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";

/** Removes known comment delimiters while retaining a map to every original source position. */
export namespace EvidenceDocumentation {
  /** Adapters must establish comment identity and attachment before calling this helper. */
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
