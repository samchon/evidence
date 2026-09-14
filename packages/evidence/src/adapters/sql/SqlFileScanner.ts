import type { Node } from "web-tree-sitter";
import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import { SourceText } from "../../internal/SourceText";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { EvidenceDatabaseSymbol } from "../../typings/EvidenceDatabaseSymbol";
import type { ISqlDeclaration } from "./ISqlDeclaration";
import type { ISqlDocumentation } from "./ISqlDocumentation";
import type { ISqlFileAnalysis } from "./ISqlFileAnalysis";
import type { ISqlPolicy } from "./ISqlPolicy";
import { SqlPolicy } from "./SqlPolicy";

/** Copies explicit CREATE TABLE declarations from the shared upstream SQL tree. */
export class SqlFileScanner {
  /** Serializable extraction owned by this scanner. */
  private readonly output: ISqlFileAnalysis;

  /** Preserves the original source, borrowed tree, and configured dialect policy. */
  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
    private readonly policy: ISqlPolicy = SqlPolicy,
  ) {
    this.output = {
      source,
      declarations: [],
      documentation: [],
      diagnostics: [],
      complete: true,
    };
  }

  /** Visits top-level statements; unsupported constructs never produce a smaller complete inventory. */
  public scan(): ISqlFileAnalysis {
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

  /** Extracts one table and every explicit column and foreign key. */
  private table(node: Node): void {
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
      const local = ordered
        ?.descendantsOfType("identifier")
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

  /** Assigns a stable endpoint-derived anonymous identity and separate relation host. */
  private relation(
    node: Node,
    table: ISqlDeclaration,
    local: string[],
    column?: ISqlDeclaration,
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
    const remoteTable = this.reference(target);
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

  /** Creates one physical declaration record with explicit model ownership. */
  private declaration(
    node: Node,
    symbol: EvidenceDatabaseSymbol,
    address: string[],
    owner?: ISqlDeclaration,
  ): ISqlDeclaration {
    const range = this.session.range(node);
    const id = `${this.source.id}:${symbol}:${node.startIndex}`;
    const record: ISqlDeclaration = {
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

  /** Decodes qualified names by syntax segments, preserving quoted literal dots. */
  private reference(node: Node): string[] | undefined {
    const names = node.namedChildren
      .filter((child) => child.type === "identifier")
      .map((child) => this.identifier(child));
    return names.length === 0 || names.some((name) => name === undefined)
      ? undefined
      : names.filter((name): name is string => name !== undefined);
  }

  /** Rejects identifiers outside the selected dialect instead of inventing an address. */
  private identifier(node: Node): string | undefined {
    const name = this.policy.identifier(node.text);
    if (name === undefined)
      this.problem(
        node,
        "This identifier is outside the configured SQL dialect's quoting and name rules.",
      );
    return name;
  }

  /** Groups adjacent line comments and binds leading documentation to the following declaration sites. */
  private documentation(nodes: Node[]): void {
    const text = new SourceText(this.source.content);
    const groups: ISqlDocumentation[] = [];
    for (const node of nodes) {
      const range = this.session.range(node);
      const previous = groups.at(-1);
      if (
        node.type === "comment" &&
        previous !== undefined &&
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
      const line = this.source.content.lastIndexOf("\n", start - 1) + 1;
      // Trailing comments never document the next table or column.
      if (this.source.content.slice(line, start).trim() === "") {
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

  /** Identifies actual grammar comments without interpreting SQL literals. */
  private comment(node: Node): boolean {
    return node.type === "comment" || node.type === "marginalia";
  }

  /** Reports a located unsupported surface and preserves incompleteness. */
  private problem(node: Node, message: string): void {
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
