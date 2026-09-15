import type { IEvidSourcePosition } from "../structures/IEvidSourcePosition";
import type { IEvidSourceRange } from "../structures/IEvidSourceRange";

/**
 * Maps original UTF-16 offsets to source coordinates without rewriting text.
 *
 * Parser and documentation positions both use JavaScript string offsets, so
 * preserving BOM and line-ending bytes avoids a later location translation.
 */
export class EvidSourceText {
  private readonly lines = [0];

  /**
   * Indexes line starts in the supplied immutable source content.
   *
   * Range conversion uses this table to translate parser UTF-16 offsets without
   * rescanning the source string for every diagnostic or host position.
   */
  public constructor(public readonly content: string) {
    for (let index = 0; index < content.length; ++index)
      if (content[index] === "\n") this.lines.push(index + 1);
  }

  /**
   * Resolves one bounded UTF-16 offset to one-based line and column
   * coordinates.
   *
   * Parser and documentation mapping consumers use this conversion when
   * emitting source ranges with human-readable positions.
   */
  public position(offset: number): IEvidSourcePosition {
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

  /**
   * Builds a validated half-open range from offsets in this exact source
   * string.
   *
   * The result includes positions derived from the same immutable content, so
   * adapters cannot pair offsets from one source snapshot with another.
   */
  public range(start: number, end: number): IEvidSourceRange {
    if (end < start) throw new Error("The source range ends before it starts.");
    return { start: this.position(start), end: this.position(end) };
  }

  /**
   * Checks whether positions and offsets agree with this source.
   *
   * It returns false for malformed or cross-content ranges, allowing callers to
   * reject invalid parser output before it enters an inventory.
   */
  public contains(range: IEvidSourceRange): boolean {
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
