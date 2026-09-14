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

/** Extracts a static SQLite schema from declarative grammar nodes.
 *
 * The scanner does not execute migrations or queries. It records only syntax
 * that establishes a stable schema and reports other constructs so they cannot
 * make a partial inventory appear complete.
 */
export class SqliteFileScanner {
  /** Collects declarations established by recognized SQLite grammar positions.
   *
   * The array remains private until `scan` returns its node-free analysis.
   */
  private readonly declarations: ISqlDeclaration[] = [];

  /** Collects findings that prevent a smaller schema from appearing complete.
   *
   * Each diagnostic identifies syntax requiring runtime interpretation or a
   * scanner capability that SQLite extraction does not support.
   */
  private readonly diagnostics: IEvidenceDiagnostic[] = [];

  /** Maps SQLite node offsets into original UTF-16 source coordinates.
   *
   * Documentation and declaration sites share this coordinate authority.
   */
  private readonly text: SourceText;

  /** Initializes one scanner over a borrowed session and immutable source.
   *
   * The session supplies grammar nodes only during the scan; the returned
   * analysis contains no node references after this object finishes.
   */
  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
  ) {
    this.text = new SourceText(source.content);
  }

  /** Returns declarations, documentation carriers, and truthful completeness.
   *
   * Every unsupported statement records a diagnostic before the result reports
   * completion, preventing a reduced schema from passing coverage checks.
   */
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

  /** Creates one model and its explicitly declared columns and relations.
   *
   * The method rejects query-derived tables and ambiguous names because static
   * identity must come from explicit SQLite schema syntax.
   */
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

  /** Creates a relation from a foreign-key clause with explicit endpoints.
   *
   * Relations use a namespace below their model so a constraint does not
   * collide with a column, and endpoint arity must remain verifiable.
   */
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

  /** Creates a physical declaration record distinct from normalized identity.
   *
   * SQLite case-folds semantic identity while preserving source spelling and
   * ranges for public addresses, documentation, and review fingerprints.
   */
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

  /** Attaches adjacent leading comments while retaining detached carriers.
   *
   * Grouping is limited to standalone adjacent line comments so trailing text
   * cannot accidentally document the declaration on the following line.
   */
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
        this.leading(previous) &&
        this.leading(comment) &&
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
      const attached = this.leading(first)
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

  /** Checks whether a comment begins before other content on its source line.
   *
   * Trailing comments fail this check and therefore cannot absorb the next
   * declaration's leading documentation role.
   */
  private leading(node: Node): boolean {
    return (
      this.source.content
        .slice(
          this.source.content.lastIndexOf("\n", node.startIndex - 1) + 1,
          node.startIndex,
        )
        .trim() === ""
    );
  }

  /** Checks whether only one optional line break separates two source ranges.
   *
   * Blank lines and intervening syntax detach comments from declarations and
   * from preceding line-comment fragments.
   */
  private adjacent(start: number, end: number): boolean {
    return (
      start <= end &&
      /^[\t ]*(?:\r?\n[\t ]*)?$/u.test(this.source.content.slice(start, end))
    );
  }

  /** Reports unsupported SQLite syntax without inferring runtime database state.
   *
   * The repair tells authors how to restore a declarative complete inventory
   * while the diagnostic keeps the partial result from passing as complete.
   */
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
