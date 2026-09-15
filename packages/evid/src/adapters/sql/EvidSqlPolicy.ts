import type { Node as EvidNode } from "web-tree-sitter";

/**
 * Defines the portable subset independently of the broad SQL parser grammar.
 *
 * `EvidSqlFileScanner` uses this policy to reject syntax whose meaning varies by dialect.
 */
export namespace EvidSqlPolicy {
  /**
   * Folds regular identifiers to upper case and preserves standard quoted identifiers.
   *
   * This yields portable semantic identity while retaining literal quoted spelling.
   */
  export function identifier(raw: string): string | undefined {
    if (/^"(?:[^"]|"")+"$/u.test(raw))
      return raw.slice(1, -1).replaceAll('""', '"');
    return /^[A-Za-z_][A-Za-z_0-9]*$/u.test(raw)
      ? raw.toUpperCase()
      : undefined;
  }

  /**
   * Rejects every statement or extension outside explicit portable CREATE TABLE.
   *
   * The scanner reports the returned reason so unsupported syntax cannot shrink the population.
   */
  export function validate(node: EvidNode): string | undefined {
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
      "keyword_index",
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
      "array_size_definition",
      "array_type",
    ]);
    const stack = [...node.namedChildren];
    while (stack.length !== 0) {
      const child = stack.pop();
      if (child === undefined) continue;
      if (child.type === "identifier" && identifier(child.text) === undefined)
        return "Portable SQL accepts regular ASCII and standard double-quoted identifiers only.";
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
        if (forms.has("keyword_unique") && forms.has("keyword_key"))
          return "Portable SQL uses UNIQUE, not the dialect-specific UNIQUE KEY spelling.";
        if (
          child.childForFieldName("name") !== null &&
          !forms.has("keyword_constraint")
        )
          return "Portable SQL names constraints with CONSTRAINT; dialect-specific index names are unsupported.";
        if (
          forms.has("keyword_foreign") &&
          child.childForFieldName("name") !== null
        )
          return "Named foreign-key syntax is not supported by the portable SQL grammar; use an anonymous FOREIGN KEY or a certified dialect.";
      }
      if (child.type === "column_definition") {
        const named = child.namedChildren.filter(
          (entry) => entry.type !== "comment" && entry.type !== "marginalia",
        );
        for (let index = 0; index < named.length; ++index) {
          if (named[index]?.type !== "keyword_default") continue;
          const expression = named[index + 1];
          if (
            expression === undefined ||
            !/^(?:[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|'(?:[^']|'')*'|TRUE|FALSE|NULL|CURRENT_TIMESTAMP)$/iu.test(
              expression.text.trim(),
            )
          )
            return "Portable SQL defaults require a scalar literal or CURRENT_TIMESTAMP; dialect function defaults are unsupported.";
        }
        if (named.some((entry) => entry.type === "keyword_constraint"))
          return "Named column constraints are outside the documented portable grammar subset.";
        const type = child.childForFieldName("type");
        if (
          child.childrenForFieldName("type").length !== 1 ||
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
