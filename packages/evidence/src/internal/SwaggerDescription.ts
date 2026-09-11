const TAG =
  /^@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link)(?:[ \t]|$)/u;

/** Separates operation prose from Evidence metadata appended to a description. */
export namespace SwaggerDescription {
  export function semantic(text: string): string {
    const lines = text.split("\n");
    const index = boundary(lines);
    return lines
      .slice(0, index < 0 ? lines.length : index)
      .join("\n")
      .trimEnd();
  }

  export function hasMetadata(text: string): boolean {
    return boundary(text.split("\n")) >= 0;
  }
}

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
