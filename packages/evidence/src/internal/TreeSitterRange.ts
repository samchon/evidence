import type { Node } from "web-tree-sitter";

import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";

/** Converts web-tree-sitter's UTF-16, zero-based coordinates to Evidence source ranges. */
export namespace TreeSitterRange {
  /** Returns a half-open range whose one-based positions correspond to the parser's original string input. */
  export function from(node: Node): IEvidenceSourceRange {
    return {
      start: {
        offset: node.startIndex,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
      },
      end: {
        offset: node.endIndex,
        line: node.endPosition.row + 1,
        column: node.endPosition.column + 1,
      },
    };
  }
}
