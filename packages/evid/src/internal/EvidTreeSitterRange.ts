import type { EvidNode } from "web-tree-sitter";

import type { IEvidSourceRange } from "../structures/IEvidSourceRange";

/**
 * Converts web-tree-sitter UTF-16, zero-based coordinates into Evid source ranges.
 *
 * Adapters use this boundary to preserve parser offsets while exposing Evid's
 * one-based line and column positions for diagnostics, hosts, and unit sites.
 */
export namespace EvidTreeSitterRange {
  /**
   * Returns the node's half-open range in Evid coordinate conventions.
   *
   * Offsets remain the parser's UTF-16 string indices, while rows and columns are
   * incremented to the one-based positions expected by Evid consumers.
   */
  export function from(node: EvidNode): IEvidSourceRange {
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
