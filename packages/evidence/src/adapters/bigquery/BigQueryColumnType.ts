import type { Node } from "web-tree-sitter";

/** Bounds the grammar's permissive type names to declared GoogleSQL schema types. */
export namespace BigQueryColumnType {
  /** Checks scalar leaves and structural envelopes; the scanner visits every named nested field. */
  export function supported(node: Node): boolean {
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
