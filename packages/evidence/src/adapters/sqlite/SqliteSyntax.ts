import type { Node } from "web-tree-sitter";

/** Decodes SQLite source identifiers without interpreting strings as executable SQL. */
export namespace SqliteSyntax {
  /** Returns a literal name, including SQLite's context-specific single-quote spelling. */
  export function identifier(node: Node): string | undefined {
    if (node.type !== "identifier" && node.type !== "string_literal")
      return undefined;
    const raw = node.text;
    const first = raw[0];
    if (first === "[") return raw.slice(1, -1);
    if (first === '"' || first === "'" || first === "`")
      return raw.slice(1, -1).replaceAll(first + first, first);
    return raw;
  }

  /** SQLite identifier comparison folds ASCII letters while preserving other code points. */
  export function fold(value: string): string {
    return value.replace(/[A-Z]/gu, (character) => character.toLowerCase());
  }

  /** Reads direct grammar-established names, excluding names inside expressions. */
  export function names(node: Node): string[] {
    return node.namedChildren.flatMap((child) => {
      const value = identifier(child);
      return value === undefined ? [] : [value];
    });
  }
}
