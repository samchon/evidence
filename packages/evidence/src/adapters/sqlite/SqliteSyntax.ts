import type { Node } from "web-tree-sitter";

/**
 * Decodes SQLite source identifiers without interpreting strings as executable SQL.
 *
 * The SQLite scanner uses these helpers only for grammar-established name nodes.
 */
export namespace SqliteSyntax {
  /**
   * Returns a literal name, including SQLite's context-specific single-quote spelling.
   *
   * Callers pass identifier tokens, so string expressions cannot become schema names.
   */
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

  /**
   * Folds SQLite identifier ASCII letters while preserving other code points.
   *
   * This matches the adapter's comparison boundary without changing Unicode spelling.
   */
  export function fold(value: string): string {
    return value.replace(/[A-Z]/gu, (character) => character.toLowerCase());
  }

  /**
   * Reads direct grammar-established names, excluding names inside expressions.
   *
   * The returned segments remain separate so quoted dots are not treated as path delimiters.
   */
  export function names(node: Node): string[] {
    return node.namedChildren.flatMap((child) => {
      const value = identifier(child);
      return value === undefined ? [] : [value];
    });
  }
}
