import type { IEvidenceSourcePosition } from "../structures/IEvidenceSourcePosition";
import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";

/** Maps original UTF-16 offsets to coordinates without altering BOM or line endings. */
export class SourceText {
  private readonly lines = [0];

  public constructor(public readonly content: string) {
    for (let index = 0; index < content.length; ++index)
      if (content[index] === "\n") this.lines.push(index + 1);
  }

  public position(offset: number): IEvidenceSourcePosition {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > this.content.length
    )
      throw new Error("The source offset is outside the original string.");
    let left = 0;
    let right = this.lines.length;
    while (left + 1 < right) {
      const middle = Math.floor((left + right) / 2);
      if ((this.lines[middle] ?? 0) <= offset) left = middle;
      else right = middle;
    }
    return {
      offset,
      line: left + 1,
      column: offset - (this.lines[left] ?? 0) + 1,
    };
  }

  public range(start: number, end: number): IEvidenceSourceRange {
    if (end < start) throw new Error("The source range ends before it starts.");
    return { start: this.position(start), end: this.position(end) };
  }

  public contains(range: IEvidenceSourceRange): boolean {
    try {
      const expected = this.range(range.start.offset, range.end.offset);
      return (
        expected.start.line === range.start.line &&
        expected.start.column === range.start.column &&
        expected.end.line === range.end.line &&
        expected.end.column === range.end.column
      );
    } catch {
      return false;
    }
  }
}
