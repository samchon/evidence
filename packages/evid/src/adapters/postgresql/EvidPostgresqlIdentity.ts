import type { EvidNode } from "web-tree-sitter";

/**
 * Decodes PostgreSQL identifiers without relying on the session search path.
 *
 * The PostgreSQL scanner requires explicit schema paths so snapshot extraction stays deterministic.
 */
export namespace EvidPostgresqlIdentity {
  /**
   * Preserves quoted case and literal dots while folding unquoted ASCII case.
   *
   * The result is a semantic segment, so a quoted dot never creates another path segment.
   */
  export function identifier(raw: string): string | undefined {
    if (/^"(?:[^"]|"")+"$/u.test(raw)) {
      const decoded = raw.slice(1, -1).replaceAll('""', '"');
      return Buffer.byteLength(decoded, "utf8") <= 63 ? decoded : undefined;
    }
    if (Buffer.byteLength(raw, "utf8") > 63) return undefined;
    return /^[A-Za-z_\u00c0-\u017f][A-Za-z_0-9\u00c0-\u017f]*$/u.test(raw)
      ? raw.replace(/[A-Z]/gu, (letter) => letter.toLowerCase())
      : undefined;
  }

  /**
   * Reads segmented identifiers from a grammar-owned object reference.
   *
   * Invalid or missing identifier segments leave the path unresolved for the caller to diagnose.
   */
  export function path(node: EvidNode): string[] | undefined {
    const identifiers = node.descendantsOfType("identifier");
    const names = (node.type === "identifier" ? [node] : identifiers).map(
      (identifierNode) => identifier(identifierNode.text),
    );
    return names.length !== 0 && names.every((name) => name !== undefined)
      ? names
      : undefined;
  }
}
