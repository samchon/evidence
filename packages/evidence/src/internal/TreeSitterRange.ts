import type { Node } from "web-tree-sitter";

import type { IEvidenceSourceRange } from "../structures/IEvidenceSourceRange";

/** The web binding exposes UTF-16 indices and columns for JavaScript string input. */
export namespace TreeSitterRange {
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
