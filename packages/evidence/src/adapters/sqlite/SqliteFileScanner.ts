import type { Node } from "web-tree-sitter";

import { SourceText } from "../../internal/SourceText";
import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { EvidenceDatabaseSymbol } from "../../typings/EvidenceDatabaseSymbol";
import type { ISqlDeclaration } from "../sql/ISqlDeclaration";
import type { ISqlDocumentation } from "../sql/ISqlDocumentation";
import type { ISqlFileAnalysis } from "../sql/ISqlFileAnalysis";
import { SqliteSyntax } from "./SqliteSyntax";

/** Reads SQLite grammar nodes into a static schema without applying migrations. */
export class SqliteFileScanner {
  /** Declarations established by SQLite grammar positions. */
  private readonly declarations: ISqlDeclaration[] = [];

  /** Findings that prevent a smaller schema from appearing complete. */
  private readonly diagnostics: IEvidenceDiagnostic[] = [];

  /** Original UTF-16 source coordinates. */
  private readonly text: SourceText;

  /** Borrows a parser session only for the duration of one scan. */
  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
  ) {
    this.text = new SourceText(source.content);
  }

  /** Returns serializable declarations and documentation attachments. */
  public scan(): ISqlFileAnalysis {
    for (const statement of this.session.root.namedChildren) {
      if (statement.type === "comment") continue;
      if (statement.type !== "sql_stmt") {
        this.incomplete(statement, "The SQLite statement is not recognized.");
        continue;
      }
      const children = statement.namedChildren.filter(
        (child) => child.type !== "comment",
      );
      const declaration = children[0];
      if (children.length !== 1 || declaration?.type !== "create_table_stmt") {
        this.incomplete(
          statement,
          "Only explicit CREATE TABLE declarations establish a static SQLite schema; execution, virtual tables, views, triggers, ATTACH, PRAGMA, and schema mutations require runtime interpretation.",
        );
        continue;
      }
      this.table(declaration);
    }
    return {
      source: this.source,
      declarations: this.declarations,
      documentation: this.documentation(),
      diagnostics: this.diagnostics,
      complete: this.diagnostics.length === 0,
    };
  }

  /** Creates one owning model and its explicitly declared members. */
  private table(node: Node): void {
    if (node.namedChildren.some((child) => child.type === "select_stmt")) {
      this.incomplete(node, "CREATE TABLE AS requires query-derived columns.");
      return;
    }
    const names = SqliteSyntax.names(node);
    const name = names.at(-1);
    const temporary = node.namedChildren.some(
      (child) => child.type === "TEMP" || child.type === "TEMPORARY",
    );
    const schema = names.length === 2 ? names[0] : temporary ? "temp" : "main";
    if (name === undefined || schema === undefined || names.length > 2) {
      this.incomplete(node, "The SQLite table has no unambiguous schema name.");
      return;
    }
    if (temporary && SqliteSyntax.fold(schema) !== "temp") {
      this.incomplete(node, "A TEMP table may only name the temp schema.");
      return;
    }
    if (SqliteSyntax.fold(name).startsWith("sqlite_")) {
      this.incomplete(
        node,
        "SQLite reserves table names beginning with sqlite_.",
      );
      return;
    }
    const identity = [schema, name].map(SqliteSyntax.fold);
    const model = this.declare(node, "model", names, identity);
    const columns = node.namedChildren.filter(
      (child) => child.type === "column_def",
    );
    const constraints = node.namedChildren.filter(
      (child) => child.type === "table_constraint",
    );
    if (columns.length === 0)
      this.incomplete(
        node,
        "A declared SQLite table requires explicit columns.",
      );
    const columnNames = columns.flatMap((column) => {
      const columnName = SqliteSyntax.names(column)[0];
      return columnName === undefined ? [] : [SqliteSyntax.fold(columnName)];
    });
    for (const column of columns) {
      const columnName = SqliteSyntax.names(column)[0];
      if (columnName === undefined) {
        this.incomplete(column, "The SQLite column has no readable name.");
        continue;
      }
      this.declare(
        column,
        "column",
        [...names, columnName],
        [...identity, SqliteSyntax.fold(columnName)],
        model.id,
      );
      for (const constraint of column.namedChildren.filter(
        (child) => child.type === "column_constraint",
      ))
        this.relation(constraint, model, [columnName], columnNames);
    }
    for (const constraint of constraints)
      this.relation(constraint, model, undefined, columnNames);
    const first = columns[0];
    const last = [...columns, ...constraints].at(-1);
    if (first !== undefined && last !== undefined)
      model.site.content = [
        this.text.range(node.startIndex, first.startIndex),
        ...constraints
          .filter(
            (constraint) =>
              !constraint.namedChildren.some(
                (child) => child.type === "foreign_key_clause",
              ),
          )
          .map((constraint) => this.session.range(constraint)),
        this.text.range(last.endIndex, node.endIndex),
      ];
  }

  /** Preserves explicit endpoints and uses a separate relation namespace below the model. */
  private relation(
    node: Node,
    model: ISqlDeclaration,
    inline: string[] | undefined,
    columns: string[],
  ): void {
    const clause = node.namedChildren.find(
      (child) => child.type === "foreign_key_clause",
    );
    if (clause === undefined) return;
    const named = node.namedChildren.some(
      (child) => child.type === "CONSTRAINT",
    );
    const names = SqliteSyntax.names(node);
    const constraintName = named ? names[0] : undefined;
    const local = inline ?? names.slice(named ? 1 : 0);
    const action = clause.namedChildren.findIndex((child) =>
      ["ON", "MATCH", "NOT", "DEFERRABLE"].includes(child.type),
    );
    const remote = clause.namedChildren
      .slice(0, action < 0 ? undefined : action)
      .flatMap((child) => {
        const name = SqliteSyntax.identifier(child);
        return name === undefined ? [] : [name];
      });
    const target = remote[0];
    const endpoints = remote.slice(1);
    if (
      local.length === 0 ||
      target === undefined ||
      local.some((name) => !columns.includes(SqliteSyntax.fold(name))) ||
      (endpoints.length !== 0 && endpoints.length !== local.length)
    ) {
      this.incomplete(
        node,
        "The foreign key requires declared local columns and matching explicit endpoint arity.",
      );
      return;
    }
    const segment =
      constraintName === undefined
        ? `foreign key:${JSON.stringify(local)}->${JSON.stringify([target, ...endpoints])}`
        : `foreign key:${constraintName}`;
    this.declare(
      node,
      "relation",
      [...model.address, segment],
      [...model.identity, SqliteSyntax.fold(segment)],
      model.id,
    );
  }

  /** Records physical sites independently from case-insensitive schema identity. */
  private declare(
    node: Node,
    symbol: EvidenceDatabaseSymbol,
    address: string[],
    identity: string[],
    ownerDeclarationId?: string,
  ): ISqlDeclaration {
    const id = `${this.source.id}:${symbol}:${node.startIndex}`;
    const range = this.session.range(node);
    const declaration: ISqlDeclaration = {
      id,
      name: address.at(-1) ?? "",
      symbol,
      identity,
      address,
      ...(identity.length === address.length + 1
        ? { aliases: [[identity[0] ?? "main", ...address]] }
        : {}),
      site: {
        id: `${id}:site`,
        file: this.source.physicalPath,
        range,
        content: [range],
      },
      ...(ownerDeclarationId === undefined ? {} : { ownerDeclarationId }),
      public: true,
    };
    this.declarations.push(declaration);
    return declaration;
  }

  /** Attaches adjacent leading comments while retaining detached annotation carriers. */
  private documentation(): ISqlDocumentation[] {
    const comments = this.session
      .captures("(comment) @comment")
      .map((capture) => capture.node)
      .sort((left, right) => left.startIndex - right.startIndex);
    const groups: Node[][] = [];
    for (const comment of comments) {
      const group = groups.at(-1);
      const previous = group === undefined ? undefined : group.at(-1);
      if (
        group !== undefined &&
        previous !== undefined &&
        previous.text.startsWith("--") &&
        comment.text.startsWith("--") &&
        this.adjacent(previous.endIndex, comment.startIndex)
      )
        group.push(comment);
      else groups.push([comment]);
    }
    return groups.flatMap((group) => {
      const first = group[0];
      const last = group.at(-1);
      if (first === undefined || last === undefined) return [];
      const prefix = this.source.content.slice(
        this.source.content.lastIndexOf("\n", first.startIndex - 1) + 1,
        first.startIndex,
      );
      const attached =
        prefix.trim() === ""
          ? this.declarations.filter((declaration) =>
              this.adjacent(last.endIndex, declaration.site.range.start.offset),
            )
          : [];
      return [
        {
          id: `${this.source.id}:documentation:${first.startIndex}`,
          range: this.text.range(first.startIndex, last.endIndex),
          attachments: attached.map((declaration) => ({
            declarationId: declaration.id,
            siteId: declaration.site.id,
          })),
          syntax: {
            opening: first.text.startsWith("--")
              ? "--"
              : first.text.startsWith("/**")
                ? "/**"
                : "/*",
            closing: first.text.startsWith("--") ? "" : "*/",
            linePrefix: first.text.startsWith("--") ? "--" : "*",
            tagBoundaries: false,
            allowWithdrawal: true,
          },
        },
      ];
    });
  }

  /** Blank lines or intervening syntax detach a leading documentation run. */
  private adjacent(start: number, end: number): boolean {
    return (
      start <= end &&
      /^[\t ]*(?:\r?\n[\t ]*)?$/u.test(this.source.content.slice(start, end))
    );
  }

  /** Reports a truthful repair without inferring a runtime database state. */
  private incomplete(node: Node, message: string): void {
    this.diagnostics.push({
      code: "unsupported-sqlite-syntax",
      severity: "error",
      message,
      repair:
        "Select a declarative SQLite schema with explicit CREATE TABLE statements, or implement this construct before relying on a complete inventory.",
      location: {
        file: this.source.physicalPath,
        range: this.session.range(node),
      },
    });
  }
}
