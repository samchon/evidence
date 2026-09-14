import type { Node } from "web-tree-sitter";

import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IDbmlEndpoint } from "./IDbmlEndpoint";
import type { IDbmlFileAnalysis } from "./IDbmlFileAnalysis";

/** Extracts DBML declarations only from the audited parser's structural nodes. */
export class DbmlFileScanner {
  /** Serializable result owned by this scan. */
  private readonly output: IDbmlFileAnalysis;

  /** Declaration owners keyed by parser-recognized start offsets. */
  private readonly owners = new Map<number, string[][]>();

  /** Line comments already included in one contiguous documentation carrier. */
  private readonly comments = new Set<number>();

  /** Borrows a parser session only for the duration of extraction. */
  public constructor(
    private readonly session: EvidenceParseSession,
    source: IEvidenceSourceFile,
  ) {
    this.output = {
      source,
      declarations: [],
      relations: [],
      documentation: [],
      enums: [],
      diagnostics: [],
      complete: true,
    };
  }

  /** Extracts every top-level construct and establishes note/comment attachment. */
  public scan(): IDbmlFileAnalysis {
    for (const node of this.session.root.namedChildren) {
      if (node.type === "definition") this.table(node);
      else if (node.type === "reference") this.relation(node);
      else if (node.type === "enum") this.enumeration(node);
      else if (node.type === "table_partial" || node.type === "table_group")
        this.problem(
          node,
          `DBML ${node.type} is outside the declared schema boundary. Expand reusable partials and remove groups from selected schema files before checking coverage.`,
        );
      else if (node.type !== "comment" && node.type !== "project")
        this.problem(
          node,
          `Unsupported DBML construct '${node.type}'. Add adapter support before checking coverage.`,
        );
    }
    for (const capture of this.session.captures("(comment) @comment"))
      this.comment(capture.node);
    for (const capture of this.session.captures("(note) @note"))
      this.note(capture.node);
    for (const capture of this.session.captures("(attribute) @attribute")) {
      const identifier = capture.node.namedChildren.find(
        (child) => child.type === "identifier",
      );
      if (
        identifier !== undefined &&
        /^(ref|note|default)$/iu.test(identifier.text)
      )
        this.problem(
          capture.node,
          "A reserved DBML ref/note/default setting is missing its required value. Correct the setting before checking coverage.",
        );
    }
    return this.output;
  }

  /** Retains enum dependencies and rejects duplicate enum values. */
  private enumeration(node: Node): void {
    const name = node.childForFieldName("name");
    if (name === null) throw new Error("A DBML enum has no name.");
    const values = node.namedChildren
      .filter((child) => child.type === "enum_item")
      .map((child) =>
        child.namedChildren.find((entry) => entry.type === "identifier"),
      )
      .filter((entry) => entry !== undefined)
      .map((entry) => this.identifier(entry));
    if (new Set(values).size !== values.length)
      this.problem(
        node,
        "A DBML enum repeats a value. Use distinct enum values before checking coverage.",
      );
    this.output.enums.push({
      identity: this.tableName(name),
      content: this.semantic(node),
      range: this.session.range(node),
    });
  }

  /** Publishes a table and the scalar columns that it directly owns. */
  private table(node: Node): void {
    const name = node.childForFieldName("name");
    const body = node.childForFieldName("body");
    if (name === null || body === null)
      throw new Error("A DBML table has no name or body.");
    const identity = this.tableName(name);
    const alias = node.childForFieldName("alias");
    this.output.declarations.push({
      identity,
      symbol: "model",
      content: this.semantic(node),
      range: this.session.range(node),
      ...(alias === null ? {} : { alias: this.identifier(alias) }),
    });
    this.owners.set(node.startIndex, [identity]);
    this.owners.set(body.startIndex, [identity]);
    for (const child of body.namedChildren) {
      if (child.type === "partial_injection") {
        this.problem(
          child,
          "DBML partial injection can change columns and relations. Expand the partial in selected source or implement partial resolution before checking coverage.",
        );
        continue;
      }
      if (child.type !== "item") continue;
      const columnName = child.childForFieldName("name");
      if (columnName === null) throw new Error("A DBML column has no name.");
      const column = [...identity, this.identifier(columnName)];
      const owners = [column];
      this.output.declarations.push({
        identity: column,
        symbol: "column",
        content: this.semantic(child),
        range: this.session.range(child),
      });
      this.owners.set(child.startIndex, owners);
      for (const ref of child.descendantsOfType("inline_ref")) {
        const key = ["$relation", String(ref.startIndex)];
        owners.push(key);
        const target = ref.namedChildren.find(
          (entry) => entry.type === "column",
        );
        const cardinality = ref.namedChildren.find(
          (entry) => entry.type === "cardinality",
        );
        if (target === undefined || cardinality === undefined)
          throw new Error(
            "An inline DBML relation has no endpoint or cardinality.",
          );
        this.output.relations.push({
          identity: key,
          from: { table: identity, columns: [this.identifier(columnName)] },
          to: this.endpoint(target),
          cardinality: cardinality.text,
          inline: true,
          content: this.semantic(ref),
          range: this.session.range(child),
        });
      }
    }
  }

  /** Retains relation endpoints until all selected schema tables are known. */
  private relation(node: Node): void {
    const body = node.namedChildren.find(
      (child) => child.type === "relationship",
    );
    if (body === undefined) throw new Error("A DBML relation has no body.");
    const from = body.childForFieldName("from");
    const to = body.childForFieldName("to");
    const cardinality = body.namedChildren.find(
      (child) => child.type === "cardinality",
    );
    if (from === null || to === null || cardinality === undefined)
      throw new Error("A DBML relation has incomplete endpoints.");
    const identity = ["$relation", String(node.startIndex)];
    const name = node.childForFieldName("name");
    this.owners.set(node.startIndex, [identity]);
    this.output.relations.push({
      identity,
      ...(name === null ? {} : { name: this.identifier(name) }),
      from: this.endpoint(from),
      to: this.endpoint(to),
      cardinality: cardinality.text,
      inline: false,
      content: this.semantic(node),
      range: this.session.range(node),
    });
  }

  /** Resolves only syntactic endpoint segments; semantic existence is a later pass. */
  private endpoint(node: Node): IDbmlEndpoint {
    const table = node.childForFieldName("table");
    const columns = node.childForFieldName("columns");
    if (table === null || columns === null)
      throw new Error("A DBML endpoint is incomplete.");
    return {
      table: this.tableName(table),
      columns:
        columns.type === "identifier"
          ? [this.identifier(columns)]
          : columns.namedChildren
              .filter((child) => child.type === "identifier")
              .map((child) => this.identifier(child)),
    };
  }

  /** Applies DBML's implicit public schema without collapsing literal identifier dots. */
  private tableName(node: Node): string[] {
    const schema = node.namedChildren.find((child) => child.type === "schema");
    const name = node.namedChildren.find(
      (child) => child.type === "identifier",
    );
    const schemaName =
      schema === undefined
        ? undefined
        : schema.namedChildren.find((child) => child.type === "identifier");
    if (name === undefined)
      throw new Error("A DBML table identifier is incomplete.");
    return [
      schemaName === undefined ? "public" : this.identifier(schemaName),
      this.identifier(name),
    ];
  }

  /** Decodes quoted identifiers while retaining their case and literal punctuation. */
  private identifier(node: Node): string {
    const text = node.text;
    return text.startsWith('"')
      ? text.slice(1, -1).replace(/\\(.)/gu, "$1")
      : text;
  }

  /** Attaches adjacent comments only to a recognized declaration at the same syntax level. */
  private comment(node: Node): void {
    if (this.comments.has(node.startIndex)) return;
    const block = node.text.startsWith("/*");
    let last = node;
    if (!block && this.standalone(node))
      while (
        last.nextNamedSibling?.type === "comment" &&
        last.nextNamedSibling.text.startsWith("//") &&
        this.standalone(last.nextNamedSibling) &&
        this.adjacent(last, last.nextNamedSibling)
      ) {
        last = last.nextNamedSibling;
        this.comments.add(last.startIndex);
      }
    let current = last;
    let next = last.nextNamedSibling;
    let adjacent = true;
    while (next?.type === "comment") {
      adjacent &&= this.adjacent(current, next);
      current = next;
      next = next.nextNamedSibling;
    }
    const owners =
      next === null ||
      !this.standalone(node) ||
      !adjacent ||
      !this.adjacent(current, next)
        ? []
        : (this.owners.get(next.startIndex) ?? []);
    const range = {
      start: this.session.range(node).start,
      end: this.session.range(last).end,
    };
    this.output.documentation.push({
      owners,
      range,
      annotationRange: range,
      syntax: {
        opening: block ? "/*" : "//",
        closing: block ? "*/" : "",
        linePrefix: block ? "*" : "//",
        tagBoundaries: true,
        allowWithdrawal: owners.length !== 0,
      },
    });
  }

  /** Keeps trailing comments separate from leading documentation runs. */
  private standalone(node: Node): boolean {
    const start =
      this.output.source.content.lastIndexOf("\n", node.startIndex - 1) + 1;
    return (
      this.output.source.content.slice(start, node.startIndex).trim() === ""
    );
  }

  /** Requires documentation runs to touch their next declaration without a blank line. */
  private adjacent(previous: Node, next: Node): boolean {
    const gap = this.output.source.content.slice(
      previous.endIndex,
      next.startIndex,
    );
    return gap.trim() === "" && (gap.match(/\n/gu)?.length ?? 0) <= 1;
  }

  /** Attaches table/column notes; enum, index and project notes remain unsupported carriers. */
  private note(node: Node): void {
    const value = node.namedChildren.find((child) => child.type === "string");
    if (value === undefined)
      throw new Error("A DBML note has no string value.");
    let parent = node.parent;
    if (parent?.type === "setting") parent = parent.parent;
    const owners =
      parent === null ? [] : (this.owners.get(parent.startIndex) ?? []);
    const delimiter = value.text.startsWith("'''") ? "'''" : "'";
    this.output.documentation.push({
      owners,
      range: this.session.range(value),
      annotationRange: this.session.range(node),
      syntax: {
        opening: delimiter,
        closing: delimiter,
        tagBoundaries: true,
        allowWithdrawal: owners.length !== 0,
      },
    });
  }

  /** Retains enum semantics without treating their notes/comments as acknowledgements. */
  private semantic(node: Node): string {
    if (node.type === "comment" || node.type === "note") return "";
    if (
      node.type === "setting" &&
      node.namedChildren.every(
        (child) => child.type === "note" || child.type === "comment",
      )
    )
      return "";
    if (node.childCount === 0) return node.type === "," ? "" : node.text;
    return node.children
      .map((child) => this.semantic(child))
      .filter((text) => text !== "")
      .join("\u0000");
  }

  /** Marks unsupported source as incomplete rather than shrinking selected obligations. */
  private problem(node: Node, message: string): void {
    this.output.complete = false;
    this.output.diagnostics.push({
      code: "dbml-unsupported-syntax",
      severity: "error",
      message,
      repair:
        "Add support for this construct or expand it to supported DBML declarations.",
      location: {
        file: this.output.source.physicalPath,
        range: this.session.range(node),
      },
    });
  }
}
