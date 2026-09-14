import type { Node } from "web-tree-sitter";

import { MysqlIdentifier } from "./MysqlIdentifier";

/** Validates the explicitly selected MySQL CREATE TABLE source subset. */
export namespace MysqlPolicy {
  /** Retains source spelling independently of lower_case_table_names and the host operating system. */
  export const identifier = MysqlIdentifier.read;

  /** Ignores column REFERENCES because MySQL does not create a foreign key from that syntax. */
  export const inlineReferences = "ignore" as const;

  /** FOREIGN KEY index names do not name MySQL constraints; endpoints identify the relation. */
  export const constraintNames = false;

  /** An unqualified REFERENCES target belongs to its explicitly qualified owning database. */
  export function reference(target: string[], owner: string[]): string[] {
    return target.length === 1 && owner.length === 2
      ? [...owner.slice(0, 1), ...target]
      : target;
  }

  /** Rejects environment state and syntax from the shared grammar's other dialects. */
  export function validate(node: Node): string | undefined {
    if (node.type === "comment" || node.type === "marginalia") {
      if (node.type === "comment" && !/^--(?:\s|$)/u.test(node.text))
        return "MySQL line comments require whitespace after --; correct the source before checking coverage.";
      return node.text.startsWith("/*!")
        ? "MySQL executable comments can change the schema; supply their explicit CREATE TABLE declarations."
        : undefined;
    }
    if (node.type !== "create_table")
      return "MySQL supports explicit CREATE TABLE declarations only; materialize migrations, routines, dynamic SQL, views, and session-dependent schema state first.";
    if (node.namedChildren.some((child) => !TABLE_CHILDREN.has(child.type)))
      return "This MySQL table uses unsupported schema derivation or storage syntax; provide the documented explicit CREATE TABLE form.";
    const nodes = descendants(node);
    if (
      node.namedChildren.filter(
        (child) =>
          child.type === "table_option" && /^COMMENT\s*=/i.test(child.text),
      ).length > 1
    )
      return "Use one table COMMENT option so documentation has one unambiguous owner and value.";
    if (nodes.some((child) => FORBIDDEN.has(child.type)))
      return "This MySQL table uses unsupported temporary, conditional, generated, inherited, or query-derived schema syntax; provide an unconditional explicit table definition.";
    for (const child of nodes) {
      if (child.type === "literal" && child.text.startsWith("$"))
        return "Dollar-quoted SQL literals are not MySQL source syntax; use a MySQL string literal.";
      if (
        child.type === "cast" &&
        child.children.some((token) => token.type === "::")
      )
        return "PostgreSQL cast syntax is not MySQL source syntax; use a MySQL CAST expression.";
      if (child.type === "identifier" && identifier(child.text) === undefined)
        return "Use MySQL unquoted or backtick-quoted source names; ANSI_QUOTES and other dialect identifier modes are not inferred.";
      if (
        child.type === "object_reference" &&
        child.namedChildren.filter((item) => item.type === "identifier")
          .length > 2
      )
        return "MySQL table names have at most database and table segments.";
      if (child.type === "table_option") {
        const message = tableOption(child);
        if (message !== undefined) return message;
      }
    }
    const definitions = nodes.filter(
      (child) => child.type === "column_definition",
    );
    const names = new Set<string>();
    for (const column of definitions) {
      if (column.namedChildren.some((child) => child.type === "direction"))
        return "ASC and DESC belong to MySQL index columns, not ordinary column definitions.";
      if (column.namedChildren.some((child) => child.type === "keyword_as"))
        return "Generated MySQL columns are outside the explicit ordinary-column subset.";
      if (
        column.namedChildren.filter((child) => child.type === "keyword_comment")
          .length > 1
      )
        return "Use one column COMMENT clause so documentation has one unambiguous value.";
      const raw = column.childForFieldName("name")?.text;
      const name = raw === undefined ? undefined : identifier(raw);
      if (name === undefined)
        return "The MySQL column name is unsupported; use an explicit identifier.";
      const folded = name.toLowerCase();
      if (names.has(folded))
        return "MySQL column names are case-insensitive; remove duplicate column declarations differing only by case.";
      names.add(folded);
      const type = column.childForFieldName("type")?.text;
      if (
        type === undefined ||
        !/^(?:(?:TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|DECIMAL|DEC|NUMERIC|FIXED|FLOAT|DOUBLE(?:\s+PRECISION)?|REAL|BIT|BOOL|BOOLEAN|CHAR|VARCHAR|BINARY|VARBINARY|TINYBLOB|BLOB|MEDIUMBLOB|LONGBLOB|TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT|DATE|TIME|DATETIME|TIMESTAMP|YEAR|JSON)(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?(?:\s+(?:UNSIGNED|ZEROFILL))*|(?:ENUM|SET)\s*\(\s*'(?:[^'\\]|'')*'(?:\s*,\s*'(?:[^'\\]|'')*')*\s*\))$/i.test(
          type,
        )
      )
        return "The MySQL column type is outside the supported explicit built-in type subset.";
    }
    return undefined;
  }
}

/** Collects a statement's named syntax, keeping strings opaque. */
function descendants(node: Node): Node[] {
  return [node, ...node.namedChildren.flatMap(descendants)];
}

/** Accepts a bounded set of MySQL options whose schema and documentation ownership are static. */
function tableOption(node: Node): string | undefined {
  const raw = node.text;
  if (
    /^ENGINE\s*=\s*(?:InnoDB|NDB|NDBCLUSTER|MyISAM|MEMORY|CSV|ARCHIVE|BLACKHOLE)\s*$/i.test(
      raw,
    )
  )
    return undefined;
  if (/^COMMENT\s*=\s*'(?:[^'\\]|'')*'\s*$/is.test(raw)) return undefined;
  if (/^(?:DEFAULT\s+CHARACTER\s+SET|COLLATE)\s+[A-Za-z0-9_]+\s*$/i.test(raw))
    return undefined;
  if (/^(?:CHARSET|COLLATE)\s*=\s*[A-Za-z0-9_]+\s*$/i.test(raw))
    return undefined;
  if (
    /^ROW_FORMAT\s*=\s*(?:DEFAULT|DYNAMIC|FIXED|COMPRESSED|REDUNDANT|COMPACT)\s*$/i.test(
      raw,
    )
  )
    return undefined;
  return "This MySQL table option is outside the supported ENGINE, COMMENT, character set, collation, and row-format subset.";
}

/** Keywords and nodes whose effects require state or semantics outside the declared subset. */
const FORBIDDEN = new Set([
  "array",
  "array_size_definition",
  "keyword_nulls",
  "keyword_temporary",
  "keyword_temp",
  "keyword_unlogged",
  "keyword_external",
  "keyword_if",
  "keyword_generated",
  "keyword_virtual",
  "keyword_stored",
  "keyword_inherits",
  "keyword_partition",
  "keyword_partitioned",
  "select",
  "select_expression",
  "create_query",
  "keyword_tablespace",
]);

/** Accepted direct syntax makes unrelated shared-grammar dialect options fail closed. */
const TABLE_CHILDREN = new Set([
  "keyword_create",
  "keyword_table",
  "object_reference",
  "column_definitions",
  "table_option",
  "comment",
  "marginalia",
]);
