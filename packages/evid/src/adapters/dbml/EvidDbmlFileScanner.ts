import type { Node as EvidNode } from "web-tree-sitter";

import type { EvidParseSession } from "../../parsers/EvidParseSession";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidDbmlEndpoint } from "./IEvidDbmlEndpoint";
import type { IEvidDbmlFileAnalysis } from "./IEvidDbmlFileAnalysis";

/**
 * Extracts DBML schema facts from audited structural parser nodes.
 *
 * It records unsupported syntax as incomplete so selection cannot silently omit
 * declarations the adapter does not understand.
 */
export class EvidDbmlFileScanner {
  /**
   * Accumulates the serializable analysis for this source file.
   *
   * Later adapter stages resolve its relations, enum dependencies, and
   * documentation carriers.
   */
  private readonly output: IEvidDbmlFileAnalysis;

  /**
   * Maps parser-node offsets to declaration identities they own.
   *
   * Notes and comments use this map to attach only at the matching syntax
   * level.
   */
  private readonly owners = new Map<number, string[][]>();

  /**
   * Tracks line comments already included in a contiguous documentation
   * carrier.
   *
   * Each comment can contribute to at most one attachment run.
   */
  private readonly comments = new Set<number>();

  /**
   * Binds the parsed DBML session and its immutable source snapshot.
   *
   * Parser nodes are used only during extraction; the returned result contains
   * serializable facts.
   */
  public constructor(
    private readonly session: EvidParseSession,
    source: IEvidSourceFile,
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

  /**
   * Extracts top-level DBML constructs and their documentation attachments.
   *
   * A complete result contains every recognized declaration and explicit
   * unsupported-syntax diagnostic.
   */
  public scan(): IEvidDbmlFileAnalysis {
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

  /**
   * Retains enum semantic dependencies and validates their members.
   *
   * Duplicate values make the declared schema ambiguous for dependent
   * fingerprints.
   */
  private enumeration(node: EvidNode): void {
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

  /**
   * Publishes a table and scalar columns directly owned by it.
   *
   * Nested constructs are handled separately so each declaration has an
   * unambiguous owner.
   */
  private table(node: EvidNode): void {
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

  /**
   * Retains relation endpoints until selected-schema declarations are
   * available.
   *
   * Cross-file resolution occurs after every DBML source has been scanned.
   */
  private relation(node: EvidNode): void {
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

  /**
   * Reads literal endpoint segments without resolving semantic existence.
   *
   * Deferring lookup permits relations between declarations in separate source
   * files.
   */
  private endpoint(node: EvidNode): IEvidDbmlEndpoint {
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

  /**
   * Builds a table identity while applying DBML's implicit public schema.
   *
   * Literal identifier dots remain part of their quoted segments rather than
   * path separators.
   */
  private tableName(node: EvidNode): string[] {
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

  /**
   * Decodes quoted identifiers without altering their case or punctuation.
   *
   * Literal spelling is required to preserve the DBML identity used by
   * resolution.
   */
  private identifier(node: EvidNode): string {
    const text = node.text;
    return text.startsWith('"')
      ? text.slice(1, -1).replace(/\\(.)/gu, "$1")
      : text;
  }

  /**
   * Attaches adjacent comments only to a recognized declaration at the same
   * level.
   *
   * This prevents comments inside nested syntax from documenting an enclosing
   * declaration.
   */
  private comment(node: EvidNode): void {
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

  /**
   * Distinguishes trailing comments from leading documentation runs.
   *
   * A comment must start on otherwise blank text before it can attach forward.
   */
  private standalone(node: EvidNode): boolean {
    const start =
      this.output.source.content.lastIndexOf("\n", node.startIndex - 1) + 1;
    return (
      this.output.source.content.slice(start, node.startIndex).trim() === ""
    );
  }

  /**
   * Checks that a documentation run reaches its next declaration without a
   * blank line.
   *
   * Separation means the comment has no unambiguous declaration owner.
   */
  private adjacent(previous: EvidNode, next: EvidNode): boolean {
    const gap = this.output.source.content.slice(
      previous.endIndex,
      next.startIndex,
    );
    return gap.trim() === "" && (gap.match(/\n/gu)?.length ?? 0) <= 1;
  }

  /**
   * Attaches supported table and column notes to their owners.
   *
   * Notes on enums, indexes, and projects remain explicit unsupported
   * annotation carriers.
   */
  private note(node: EvidNode): void {
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

  /**
   * Serializes enum semantics without including annotations.
   *
   * Documentation acknowledges declarations but does not change the enum
   * fingerprint.
   */
  private semantic(node: EvidNode): string {
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

  /**
   * Marks unsupported source as incomplete and records a repairable diagnostic.
   *
   * The failure protects coverage from passing against a reduced obligation
   * set.
   */
  private problem(node: EvidNode, message: string): void {
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
