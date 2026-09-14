import type { Node } from "web-tree-sitter";

/** Defines the portable subset independently of the broad SQL parser grammar. */
export namespace SqlPolicy {
  /** Folds regular identifiers to upper case and preserves standard quoted identifiers. */
  export function identifier(raw: string): string | undefined {
    if (/^"(?:[^"]|"")+"$/u.test(raw))
      return raw.slice(1, -1).replaceAll('""', '"');
    return /^[A-Za-z_][A-Za-z_0-9]*$/u.test(raw)
      ? raw.toUpperCase()
      : undefined;
  }

  /** Rejects every statement or extension outside explicit portable CREATE TABLE. */
  export function validate(node: Node): string | undefined {
    if (node.type === "comment" || node.type === "marginalia") return undefined;
    if (node.type !== "create_table")
      return "Portable SQL accepts only explicit CREATE TABLE declarations; select a dialect adapter or add support for this statement.";
    const allowed = new Set([
      "keyword_create",
      "keyword_table",
      "object_reference",
      "column_definitions",
      "comment",
      "marginalia",
    ]);
    if (node.namedChildren.some((child) => !allowed.has(child.type)))
      return "Portable SQL does not infer conditional, temporary, query-derived, or dialect-specific tables.";
    const forbidden = new Set([
      "keyword_auto_increment",
      "keyword_generated",
      "keyword_as",
      "keyword_stored",
      "keyword_virtual",
      "keyword_comment",
      "keyword_unsigned",
      "keyword_zerofill",
      "keyword_collate",
      "keyword_nulls",
      "direction",
      "array_size",
      "array_type",
    ]);
    const stack = [...node.namedChildren];
    while (stack.length !== 0) {
      const child = stack.pop();
      if (child === undefined) continue;
      if (forbidden.has(child.type))
        return `Portable SQL does not support '${child.text}' in table declarations.`;
      if (child.type === "constraint") {
        const forms = new Set(child.namedChildren.map((entry) => entry.type));
        if (
          ![
            "keyword_foreign",
            "keyword_primary",
            "keyword_unique",
            "keyword_check",
          ].some((type) => forms.has(type))
        )
          return "Portable SQL supports only PRIMARY KEY, UNIQUE, CHECK, and FOREIGN KEY table constraints.";
        if (
          forms.has("keyword_foreign") &&
          child.childForFieldName("name") !== null
        )
          return "Named foreign-key syntax is not supported by the portable SQL grammar; use an anonymous FOREIGN KEY or a certified dialect.";
      }
      if (child.type === "column_definition") {
        const type = child.childForFieldName("type");
        if (
          type === null ||
          !/^(?:SMALLINT|INTEGER|INT|BIGINT|DECIMAL|NUMERIC|REAL|DOUBLE\s+PRECISION|FLOAT|BOOLEAN|CHAR(?:ACTER)?|VARCHAR|CHARACTER\s+VARYING|DATE|TIME|TIMESTAMP)(?:\s*\(\s*\d+\s*(?:,\s*\d+\s*)?\))?$/iu.test(
            type.text,
          )
        )
          return "Portable SQL columns require a documented standard scalar data type.";
      }
      stack.push(...child.namedChildren);
    }
    return undefined;
  }
}
