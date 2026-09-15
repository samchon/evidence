import type { EvidNode } from "web-tree-sitter";
import type { EvidParseSession } from "../../parsers/EvidParseSession";
import { EvidSourceText } from "../../internal/EvidSourceText";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { EvidDatabaseSymbol } from "../../typings/EvidDatabaseSymbol";
import type { IEvidSqlDeclaration } from "./IEvidSqlDeclaration";
import type { IEvidSqlDocumentation } from "./IEvidSqlDocumentation";
import type { IEvidSqlFileAnalysis } from "./IEvidSqlFileAnalysis";
import type { IEvidSqlPolicy } from "./IEvidSqlPolicy";
import { EvidSqlPolicy } from "./EvidSqlPolicy";

/** Extracts explicit SQL table declarations from a shared upstream syntax tree.
 *
 * The scanner records serializable declarations and comment carriers under a
 * dialect policy. Unsupported syntax makes the analysis incomplete so omitted
 * declarations cannot shrink the coverage population.
 */
export class EvidSqlFileScanner {
  /** Holds the mutable serializable result owned by this scan.
   *
   * Helpers append records and failures here before `scan` returns the final
   * node-free analysis.
   */
  private readonly output: IEvidSqlFileAnalysis;

  /** Initializes one scan over a borrowed parse session and source snapshot.
   *
   * The default policy supplies generic SQL behavior; dialect adapters provide
   * another policy when quoting, identities, or relation syntax differ.
   */
  public constructor(
    private readonly session: EvidParseSession,
    private readonly source: IEvidSourceFile,
    private readonly policy: IEvidSqlPolicy = EvidSqlPolicy,
  ) {
    this.output = {
      source,
      declarations: [],
      documentation: [],
      diagnostics: [],
      complete: true,
    };
  }

  /** Visits statements and comments, then returns their serializable analysis.
   *
   * Validation precedes extraction so unsupported constructs record a failure
   * instead of yielding a deceptively complete smaller inventory.
   */
  public scan(): IEvidSqlFileAnalysis {
    for (const root of this.session.root.namedChildren) {
      if (this.comment(root)) continue;
      const statement =
        root.type === "statement"
          ? root.namedChildren.find((child) => !this.comment(child))
          : root;
      if (statement === undefined) continue;
      const problem = this.policy.validate(statement);
      if (problem !== undefined) {
        this.problem(statement, problem);
        continue;
      }
      if (statement.type === "create_table") this.table(statement);
    }
    const comments = this.session.root.descendantsOfType([
      "comment",
      "marginalia",
    ]);
    for (const comment of comments) {
      const problem = this.policy.validate(comment);
      if (problem !== undefined) this.problem(comment, problem);
    }
    this.documentation(comments);
    return this.output;
  }

  /** Extracts one table with its explicit columns and foreign-key relations.
   *
   * Endpoint checks require declared local columns and explicit remote columns
   * because inferred schema state would make relation identity unreliable.
   */
  private table(node: EvidNode): void {
    const reference = node.namedChildren.find(
      (child) => child.type === "object_reference",
    );
    const columns = node.namedChildren.find(
      (child) => child.type === "column_definitions",
    );
    if (reference === undefined || columns === undefined) {
      this.problem(
        node,
        "An explicit table name and column list are required.",
      );
      return;
    }
    const address = this.reference(reference);
    if (address === undefined) return;
    const table = this.declaration(node, "model", address);
    const members = columns.namedChildren.filter(
      (child) => child.type === "column_definition",
    );
    const declared = new Set<string>();
    for (const column of members) {
      const name = column.childForFieldName("name");
      const value = name === null ? undefined : this.identifier(name);
      if (value === undefined) continue;
      declared.add(value);
      const unit = this.declaration(
        column,
        "column",
        [...address, value],
        table,
      );
      if (
        column.namedChildren.some(
          (child) => child.type === "keyword_references",
        )
      ) {
        if (this.policy.inlineReferences === "reject")
          this.problem(
            column,
            "Inline REFERENCES is unsupported by this dialect policy.",
          );
        else if (this.policy.inlineReferences !== "ignore")
          this.relation(column, table, [value], unit);
      }
    }
    for (const constraint of columns.descendantsOfType("constraint")) {
      if (
        !constraint.namedChildren.some(
          (child) => child.type === "keyword_references",
        )
      )
        continue;
      if (
        !constraint.namedChildren.some(
          (child) => child.type === "keyword_foreign",
        )
      ) {
        this.problem(
          constraint,
          "Only FOREIGN KEY constraints can declare relations.",
        );
        continue;
      }
      const ordered = constraint.namedChildren.find(
        (child) => child.type === "ordered_columns",
      );
      const local =
        ordered === undefined
          ? undefined
          : ordered
              .descendantsOfType("identifier")
              .map((child) => this.identifier(child));
      if (
        local === undefined ||
        local.length === 0 ||
        local.some((name) => name === undefined || !declared.has(name))
      ) {
        this.problem(
          constraint,
          "Foreign-key endpoints must name explicit columns of their owning table.",
        );
        continue;
      }
      this.relation(
        constraint,
        table,
        local.filter((name): name is string => name !== undefined),
      );
    }
  }

  /** Extracts a relation with explicit local and remote endpoint identities.
   *
   * Unnamed relations derive a stable segment from their endpoints; inline
   * relations share their column's physical site for documentation ownership.
   */
  private relation(
    node: EvidNode,
    table: IEvidSqlDeclaration,
    local: string[],
    column?: IEvidSqlDeclaration,
  ): void {
    const children = node.namedChildren;
    const keyword = children.findIndex(
      (child) => child.type === "keyword_references",
    );
    const target = children
      .slice(keyword + 1)
      .find((child) => child.type === "object_reference");
    if (target === undefined) {
      this.problem(node, "Foreign keys require an explicit referenced table.");
      return;
    }
    const decodedRemote = this.reference(target);
    const remoteTable =
      decodedRemote === undefined
        ? undefined
        : (this.policy.reference?.(decodedRemote, table.address) ??
          decodedRemote);
    const remoteNodes = children.filter(
      (child) =>
        child.type === "identifier" && child.startIndex >= target.endIndex,
    );
    const remote = remoteNodes.map((child) => this.identifier(child));
    if (
      remoteTable === undefined ||
      remote.length !== local.length ||
      remote.some((name) => name === undefined)
    ) {
      this.problem(
        node,
        "Foreign keys require explicit local and referenced column lists with equal cardinality.",
      );
      return;
    }
    const name = node.childForFieldName("name");
    const constraintName =
      this.policy.constraintNames !== false &&
      column === undefined &&
      name !== null
        ? this.identifier(name)
        : undefined;
    const member =
      constraintName === undefined
        ? `foreign-key:${JSON.stringify(local)}->${JSON.stringify(remoteTable)}(${JSON.stringify(remote)})`
        : `constraint:${constraintName}`;
    const relation = this.declaration(
      node,
      "relation",
      [...table.address, member],
      table,
    );
    // An inline relation shares its physical column site, making attached documentation acknowledge both declarations.
    if (column !== undefined) relation.site = structuredClone(column.site);
  }

  /** Creates one physical declaration record and records its model ownership.
   *
   * A policy can project public address spelling into a separate semantic
   * identity without changing the source location retained in the record.
   */
  private declaration(
    node: EvidNode,
    symbol: EvidDatabaseSymbol,
    address: string[],
    owner?: IEvidSqlDeclaration,
  ): IEvidSqlDeclaration {
    const range = this.session.range(node);
    const id = `${this.source.id}:${symbol}:${node.startIndex}`;
    const record: IEvidSqlDeclaration = {
      id,
      name: address.at(-1) ?? "",
      symbol,
      identity: this.policy.identity?.(address, symbol) ?? address,
      address,
      public: true,
      site: {
        id: `${id}:site`,
        file: this.source.physicalPath,
        range,
        content: [range],
      },
      ...(owner === undefined ? {} : { ownerDeclarationId: owner.id }),
    };
    this.output.declarations.push(record);
    return record;
  }

  /** Decodes a qualified reference into separate address segments.
   *
   * Individual identifier decoding preserves quoted dots as literal name
   * content rather than treating them as extra path boundaries.
   */
  private reference(node: EvidNode): string[] | undefined {
    const names = node.namedChildren
      .filter((child) => child.type === "identifier")
      .map((child) => this.identifier(child));
    return names.length === 0 || names.some((name) => name === undefined)
      ? undefined
      : names.filter((name): name is string => name !== undefined);
  }

  /** Decodes a dialect identifier and reports unsupported spelling.
   *
   * Returning no name prevents callers from inventing an address outside the
   * dialect contract.
   */
  private identifier(node: EvidNode): string | undefined {
    const name = this.policy.identifier(node.text);
    if (name === undefined)
      this.problem(
        node,
        "This identifier is outside the configured SQL dialect's quoting and name rules.",
      );
    return name;
  }

  /** Groups adjacent line comments and attaches leading runs to declaration sites.
   *
   * Detached and trailing carriers remain in the result so annotation handling
   * can report them without attaching them to a later declaration.
   */
  private documentation(nodes: EvidNode[]): void {
    const text = new EvidSourceText(this.source.content);
    const groups: IEvidSqlDocumentation[] = [];
    for (const node of nodes) {
      const range = this.session.range(node);
      const previous = groups.at(-1);
      if (
        node.type === "comment" &&
        previous !== undefined &&
        this.standalone(previous.range.start.offset) &&
        this.standalone(range.start.offset) &&
        this.source.content.slice(
          previous.range.start.offset,
          previous.range.start.offset + 2,
        ) === "--" &&
        /^[ \t]*\r?\n[ \t]*$/u.test(
          this.source.content.slice(
            previous.range.end.offset,
            range.start.offset,
          ),
        )
      ) {
        previous.range = text.range(
          previous.range.start.offset,
          range.end.offset,
        );
      } else
        groups.push({
          id: `${this.source.id}:documentation:${node.startIndex}`,
          range,
          attachments: [],
        });
    }
    for (const documentation of groups) {
      const start = documentation.range.start.offset;
      // Trailing comments never document the next table or column.
      if (this.standalone(start)) {
        const next = this.output.declarations
          .filter(
            (entry) =>
              entry.site.range.start.offset >= documentation.range.end.offset,
          )
          .sort(
            (left, right) =>
              left.site.range.start.offset - right.site.range.start.offset,
          )[0];
        if (
          next !== undefined &&
          /^[ \t]*(?:\r?\n[ \t]*)?$/u.test(
            this.source.content.slice(
              documentation.range.end.offset,
              next.site.range.start.offset,
            ),
          )
        )
          documentation.attachments = this.output.declarations
            .filter(
              (entry) =>
                entry.site.range.start.offset === next.site.range.start.offset,
            )
            .map((entry) => ({
              declarationId: entry.id,
              siteId: entry.site.id,
            }));
      }
      this.output.documentation.push(documentation);
    }
  }

  /** Checks whether a comment starts before any source token on its line.
   *
   * Only such a standalone comment can be leading documentation.
   */
  private standalone(start: number): boolean {
    const line = this.source.content.lastIndexOf("\n", start - 1) + 1;
    return this.source.content.slice(line, start).trim() === "";
  }

  /** Identifies grammar nodes that represent SQL comments.
   *
   * Tree-sitter classification avoids mistaking comment-looking SQL literal
   * text for documentation syntax.
   */
  private comment(node: EvidNode): boolean {
    return node.type === "comment" || node.type === "marginalia";
  }

  /** Records a located unsupported construct and marks the result incomplete.
   *
   * This failure prevents partial extraction from being accepted as complete
   * evidence coverage.
   */
  private problem(node: EvidNode, message: string): void {
    this.output.complete = false;
    this.output.diagnostics.push({
      code: "sql-unsupported-syntax",
      severity: "error",
      message,
      repair:
        "Use the documented explicit DDL subset or implement the configured dialect's missing syntax before checking coverage.",
      location: {
        file: this.source.physicalPath,
        range: this.session.range(node),
      },
    });
  }
}
