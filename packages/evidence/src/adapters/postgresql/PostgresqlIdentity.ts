import type { Node } from "web-tree-sitter";

/** Decodes PostgreSQL identifiers without relying on the session search path. */
export namespace PostgresqlIdentity {
  /** Preserves quoted case and literal dots while folding unquoted ASCII case. */
  export function identifier(raw: string): string | undefined {
    if (/^"(?:[^"]|"")+"$/u.test(raw))
      return raw.slice(1, -1).replaceAll('""', '"');
    return /^[A-Za-z_\u00c0-\u017f][A-Za-z_0-9\u00c0-\u017f]*$/u.test(raw)
      ? raw.replace(/[A-Z]/gu, (letter) => letter.toLowerCase())
      : undefined;
  }

  /** Reads segmented identifiers from a grammar-owned object reference. */
  export function path(node: Node): string[] | undefined {
    const identifiers = node.descendantsOfType("identifier");
    const names = (node.type === "identifier" ? [node] : identifiers).map(
      (identifierNode) => identifier(identifierNode.text),
    );
    return names.length !== 0 && names.every((name) => name !== undefined)
      ? names
      : undefined;
  }
}
