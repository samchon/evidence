const TAG =
  /^@(EvidenceExcludeReview|EvidenceReview|EvidenceExclude|Evidence|link)(?:[ \t]|$)/u;

/**
 * Separates operation prose from evidence metadata appended to a description.
 *
 * Fingerprints retain author-facing prose but exclude evidence directives, which
 * control review state without changing the described API operation.
 */
export namespace EvidenceSwaggerDescription {
  /**
   * Returns description prose before the first active evidence directive.
   *
   * Directive-looking lines inside fenced examples remain semantic prose.
   */
  export function semantic(text: string): string {
    const lines = text.split("\n");
    const index = boundary(lines);
    return lines
      .slice(0, index < 0 ? lines.length : index)
      .join("\n")
      .trimEnd();
  }

  /**
   * Reports whether an active evidence directive begins in this description.
   *
   * Callers use this to decide whether the mapped scalar must become a
   * documentation carrier even when the visible prose is empty.
   */
  export function hasMetadata(text: string): boolean {
    return boundary(text.split("\n")) >= 0;
  }
}

/**
 * Finds the first directive line outside fenced Markdown examples.
 *
 * Fence tracking prevents an example annotation from changing operation review
 * metadata merely because it begins with a recognized tag.
 */
function boundary(lines: string[]): number {
  let fence = "";
  let fenceLength = 0;
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    const delimiter = /^(`{3,}|~{3,})(.*)$/u.exec(line);
    if (delimiter !== null) {
      const marker = delimiter[1] ?? "";
      if (fence === "") {
        fence = marker[0] ?? "";
        fenceLength = marker.length;
      } else if (
        marker[0] === fence &&
        marker.length >= fenceLength &&
        (delimiter[2] ?? "").trim() === ""
      )
        fence = "";
      continue;
    }
    if (fence === "" && TAG.test(line)) return index;
  }
  return -1;
}
