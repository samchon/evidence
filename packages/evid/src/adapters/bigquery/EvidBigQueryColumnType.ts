import type { EvidNode } from "web-tree-sitter";

/** Bounds the grammar's permissive type names to declared GoogleSQL schema types.
 *
 * Tree-sitter accepts broader syntax than this adapter can materialize safely,
 * so the scanner rejects fields outside this explicit semantic surface.
 */
export namespace EvidBigQueryColumnType {
  /** Checks scalar leaves and structural envelopes.
   *
   * Nested fields are validated separately by the scanner; replacing them with
   * `FIELD` here verifies only the enclosing ARRAY or STRUCT shape.
   */
  export function supported(node: EvidNode): boolean {
    const nested = node.namedChildren.filter(
      (child) => child.type === "column_definition",
    );
    let envelope = node.text;
    for (const child of [...nested].reverse()) {
      const from = child.startIndex - node.startIndex;
      const until = child.endIndex - node.startIndex;
      envelope = `${envelope.slice(0, from)}FIELD${envelope.slice(until)}`;
    }
    envelope = envelope.replace(/\s+/gu, "").toUpperCase();
    if (nested.length !== 0)
      return /^(?:STRUCT<FIELD(?:,FIELD)*>|ARRAY<STRUCT<FIELD(?:,FIELD)*>>)$/u.test(
        envelope,
      );
    if (envelope.startsWith("ARRAY<") && envelope.endsWith(">"))
      envelope = envelope.slice(6, -1);
    return (
      /^(?:INT64|INT|SMALLINT|INTEGER|BIGINT|TINYINT|BYTEINT|FLOAT64|FLOAT|BOOL|BOOLEAN|DATE|DATETIME|TIME|TIMESTAMP|INTERVAL|JSON|GEOGRAPHY)$/u.test(
        envelope,
      ) ||
      /^(?:STRING|BYTES)(?:\(\d+\))?$/u.test(envelope) ||
      /^(?:NUMERIC|DECIMAL|BIGNUMERIC|BIGDECIMAL)(?:\(\d+(?:,\d+)?\))?$/u.test(
        envelope,
      )
    );
  }
}
