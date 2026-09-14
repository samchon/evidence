import type { Node } from "web-tree-sitter";

import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { EvidenceDatabaseSymbol } from "../../typings/EvidenceDatabaseSymbol";
import type { ISqlDeclaration } from "../sql/ISqlDeclaration";
import type { ISqlDocumentation } from "../sql/ISqlDocumentation";
import type { IPostgresqlFileAnalysis } from "./IPostgresqlFileAnalysis";
import { PostgresqlIdentity } from "./PostgresqlIdentity";

/** Extracts a bounded PostgreSQL DDL surface from authoritative grammar nodes. */
export class PostgresqlFileScanner {
  /** Serializable analysis owned by this source scan. */
  private readonly output: Required<IPostgresqlFileAnalysis>;

  /** Declaration nodes retained only during this parser callback. */
  private readonly nodes = new Map<number, ISqlDeclaration[]>();

  /** Binds one borrowed syntax tree and original UTF-16 source. */
  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
  ) {
    this.output = {
      source,
      declarations: [],
      documentation: [],
      diagnostics: [],
      complete: true,
      references: [],
    };
  }

  /** Visits statements without descending into executable bodies or string examples. */
  public scan(): IPostgresqlFileAnalysis {
    for (const node of this.session.root.namedChildren) this.statement(node);
    this.comments();
    return this.output;
  }

  /** Rejects every statement outside the declared schema snapshot boundary. */
  private statement(node: Node): void {
    if (this.commentNode(node)) return;
    if (node.type === "statement") {
      for (const child of node.namedChildren) this.statement(child);
      return;
    }
    if (node.type === "create_table") this.table(node);
    else if (node.type === "create_schema") {
      if (
        node.namedChildren.some(
          (child) =>
            child.type === "keyword_if" ||
            (child.type === "identifier" &&
              PostgresqlIdentity.identifier(child.text) === undefined),
        )
      )
        this.problem(
          node,
          "CREATE SCHEMA requires unconditional PostgreSQL identifiers without server-side name truncation.",
        );
    } else if (node.type === "alter_table") this.alter(node);
    else if (node.type === "comment_statement") this.commentStatement(node);
    else
      this.problem(
        node,
        `Statement '${node.type}' is outside the PostgreSQL declared DDL surface.`,
      );
  }

  /** Publishes only tables with explicit columns and a schema-qualified owner. */
  private table(node: Node): void {
    const reference = node.namedChildren.find(
      (child) => child.type === "object_reference",
    );
    const identity =
      reference === undefined ? undefined : PostgresqlIdentity.path(reference);
    const columns = node.namedChildren.find(
      (child) => child.type === "column_definitions",
    );
    if (identity?.length !== 2 || columns === undefined) {
      this.problem(
        node,
        "CREATE TABLE requires an explicit schema-qualified name and an explicit column list; search_path, LIKE, OF, and AS-derived schemas are unsupported.",
      );
      return;
    }
    const permitted = new Set([
      "keyword_create",
      "keyword_unlogged",
      "keyword_table",
      "object_reference",
      "column_definitions",
      "comment",
      "marginalia",
    ]);
    if (node.namedChildren.some((child) => !permitted.has(child.type))) {
      this.problem(
        node,
        "Conditional creation, inheritance, partitioning, and table options require PostgreSQL schema derivation that is not implemented.",
      );
      return;
    }
    const table = this.declaration(node, "model", identity);
    for (const child of columns.namedChildren)
      if (child.type === "column_definition") this.column(child, table);
      else if (child.type === "constraints") {
        for (const constraint of child.namedChildren)
          if (!this.commentNode(constraint)) this.constraint(constraint, table);
      } else if (!this.commentNode(child))
        this.problem(
          child,
          "Unsupported table member can change the declared PostgreSQL schema.",
        );
  }

  /** Keeps ordinary columns distinct from separately selectable foreign-key relations. */
  private column(node: Node, table: ISqlDeclaration): void {
    const nameNode = node.childForFieldName("name");
    const name =
      nameNode === null
        ? undefined
        : PostgresqlIdentity.identifier(nameNode.text);
    if (name === undefined) {
      this.problem(
        node,
        "The column identifier cannot be represented as a PostgreSQL name.",
      );
      return;
    }
    if (
      node.namedChildren.some((child) =>
        [
          "keyword_auto_increment",
          "keyword_comment",
          "direction",
          "keyword_virtual",
        ].includes(child.type),
      )
    ) {
      this.problem(node, "This column uses syntax from another SQL dialect.");
      return;
    }
    this.declaration(node, "column", [...table.identity, name], table.id);
    if (node.namedChildren.some((child) => child.type === "keyword_references"))
      this.relation(node, table, [name]);
  }

  /** Treats non-relation constraints as semantic content of the owning table. */
  private constraint(
    node: Node,
    table: ISqlDeclaration,
    explicitName?: string,
  ): void {
    if (
      node.namedChildren.some((child) => child.type === "keyword_references")
    ) {
      if (
        !node.namedChildren.some((child) => child.type === "keyword_foreign") ||
        node.childForFieldName("name") !== null
      ) {
        this.problem(
          node,
          "PostgreSQL table foreign keys require FOREIGN KEY without a dialect-specific inline key name.",
        );
        return;
      }
      const columns = node.namedChildren.find(
        (child) => child.type === "ordered_columns",
      );
      const local = (columns?.namedChildren ?? [])
        .filter((child) => child.type === "column")
        .map((child) => {
          const name = child.childForFieldName("name");
          return name === null
            ? undefined
            : PostgresqlIdentity.identifier(name.text);
        });
      if (local.length === 0 || local.some((name) => name === undefined)) {
        this.problem(
          node,
          "Foreign keys require explicit local column endpoints.",
        );
        return;
      }
      this.relation(
        node,
        table,
        local.filter((name) => name !== undefined),
        explicitName,
      );
    } else if (
      node.namedChildren.some((child) => child.type === "keyword_index") ||
      (node.namedChildren.some((child) => child.type === "keyword_key") &&
        !node.namedChildren.some((child) => child.type === "keyword_primary"))
    )
      this.problem(
        node,
        "This table constraint uses non-PostgreSQL KEY or INDEX syntax.",
      );
  }

  /** Encodes every composite endpoint in stable anonymous foreign-key identities. */
  private relation(
    node: Node,
    table: ISqlDeclaration,
    local: string[],
    explicitName?: string,
  ): void {
    const target = node.namedChildren.find(
      (child) => child.type === "object_reference",
    );
    const identity =
      target === undefined ? undefined : PostgresqlIdentity.path(target);
    const targetIndex =
      target === undefined
        ? -1
        : node.namedChildren.findIndex((child) => child.id === target.id);
    const remote = node.namedChildren
      .slice(targetIndex + 1)
      .filter((child) => child.type === "identifier")
      .map((child) => PostgresqlIdentity.identifier(child.text));
    if (
      identity?.length !== 2 ||
      remote.length !== local.length ||
      remote.some((name) => name === undefined)
    ) {
      this.problem(
        node,
        "Foreign keys require schema-qualified referenced tables and equally sized explicit column endpoint lists.",
      );
      return;
    }
    const named = node.childForFieldName("name");
    const name =
      explicitName ??
      (node.type === "constraint" && named !== null
        ? PostgresqlIdentity.identifier(named.text)
        : undefined);
    const segment =
      name === undefined
        ? `foreign key ${JSON.stringify(local)} references ${JSON.stringify([...identity, ...remote])}`
        : `constraint ${name}`;
    this.declaration(node, "relation", [...table.identity, segment], table.id);
  }

  /** Supports additive ALTER declarations and rejects destructive or stateful migrations. */
  private alter(node: Node): void {
    const target = node.namedChildren.find(
      (child) => child.type === "object_reference",
    );
    const identity =
      target === undefined ? undefined : PostgresqlIdentity.path(target);
    if (identity?.length !== 2) {
      this.problem(
        node,
        "ALTER TABLE requires an explicit schema-qualified selected table.",
      );
      return;
    }
    const permitted = new Set([
      "keyword_alter",
      "keyword_table",
      "object_reference",
      "add_column",
      "add_constraint",
      "comment",
      "marginalia",
    ]);
    if (node.namedChildren.some((child) => !permitted.has(child.type))) {
      this.problem(
        node,
        "Only unconditional ALTER TABLE ADD COLUMN and ADD CONSTRAINT are supported; renames, drops, type changes, and schema moves require migration evaluation.",
      );
      return;
    }
    const table = this.declaration(node, "model", identity);
    table.merge = true;
    this.output.references.push({
      declarationId: table.id,
      identity,
      comment: false,
    });
    for (const child of node.namedChildren) {
      if (child.type === "add_column") {
        if (
          !child.namedChildren.some((part) => part.type === "keyword_add") ||
          child.namedChildren.some((part) =>
            ["keyword_if", "column_position"].includes(part.type),
          )
        ) {
          this.problem(
            child,
            "ADD COLUMN must be unconditional PostgreSQL syntax without a positional clause.",
          );
          continue;
        }
        const column = child.namedChildren.find(
          (part) => part.type === "column_definition",
        );
        if (column !== undefined) this.column(column, table);
      } else if (child.type === "add_constraint") {
        if (
          !child.namedChildren.some(
            (part) => part.type === "keyword_constraint",
          )
        ) {
          this.problem(
            child,
            "PostgreSQL named constraints require ADD CONSTRAINT name.",
          );
          continue;
        }
        const nameNode = child.namedChildren.find(
          (part) => part.type === "identifier",
        );
        const name =
          nameNode === undefined
            ? undefined
            : PostgresqlIdentity.identifier(nameNode.text);
        const constraint = child.namedChildren.find(
          (part) => part.type === "constraint",
        );
        if (constraint !== undefined && name !== undefined)
          this.constraint(constraint, table, name);
        else
          this.problem(
            child,
            "ADD CONSTRAINT requires a supported explicit named constraint.",
          );
      }
    }
  }

  /** Attaches COMMENT ON TABLE/COLUMN strings to the selected declaration identity. */
  private commentStatement(node: Node): void {
    const column = node.namedChildren.some(
      (child) => child.type === "keyword_column",
    );
    const table = node.namedChildren.some(
      (child) => child.type === "keyword_table",
    );
    const target = node.namedChildren.find(
      (child) => child.type === "object_reference",
    );
    const identity =
      target === undefined ? undefined : PostgresqlIdentity.path(target);
    const literal = node.namedChildren.find(
      (child) => child.type === "literal",
    );
    if (
      (!column && !table) ||
      identity?.length !== (column ? 3 : 2) ||
      literal === undefined ||
      !/^'(?:[^']|'')*'$/su.test(literal.text)
    ) {
      this.problem(
        node,
        "COMMENT requires one schema-qualified TABLE or COLUMN and an ordinary single-quoted string; NULL replacement and other targets are unsupported.",
      );
      return;
    }
    const declaration = this.declaration(
      node,
      column ? "column" : "model",
      identity,
    );
    declaration.site.id += ":comment";
    declaration.merge = true;
    this.output.references.push({
      declarationId: declaration.id,
      identity,
      comment: true,
    });
    const mapped = EvidenceDocumentation.read(
      this.source.content,
      "pending",
      this.session.range(literal),
      {
        opening: "'",
        closing: "'",
        tagBoundaries: false,
        allowWithdrawal: true,
      },
    );
    let text = "";
    const offsets: number[] = [];
    const ends: number[] = [];
    for (let index = 0; index < mapped.text.length; ++index) {
      text += mapped.text[index];
      offsets.push(mapped.offsets[index] ?? literal.startIndex);
      if (mapped.text[index] === "'" && mapped.text[index + 1] === "'") ++index;
      ends.push(mapped.ends[index] ?? literal.endIndex);
    }
    offsets.push(literal.endIndex - 1);
    this.output.documentation.push({
      id: `${declaration.id}:comment`,
      range: this.session.range(literal),
      attachments: [
        { declarationId: declaration.id, siteId: declaration.site.id },
      ],
      mapped: { ...mapped, text, offsets, ends },
    });
  }

  /** Creates one physical declaration with a semantic identity independent of its file. */
  private declaration(
    node: Node,
    symbol: EvidenceDatabaseSymbol,
    identity: string[],
    ownerDeclarationId?: string,
  ): ISqlDeclaration {
    const id = `postgresql:${this.source.id}:${node.startIndex}:${symbol}`;
    const range = this.session.range(node);
    const declaration: ISqlDeclaration = {
      id,
      name: identity.at(-1) ?? "",
      symbol,
      identity,
      address: identity,
      site: {
        id: `${id}:site`,
        file: this.source.physicalPath,
        range,
        content: [range],
      },
      public: true,
      ...(ownerDeclarationId === undefined ? {} : { ownerDeclarationId }),
    };
    this.output.declarations.push(declaration);
    const declarations = this.nodes.get(node.startIndex) ?? [];
    declarations.push(declaration);
    this.nodes.set(node.startIndex, declarations);
    return declaration;
  }

  /** Establishes adjacent SQL comment ownership before shared annotation parsing. */
  private comments(): void {
    const comments = this.session.root.descendantsOfType([
      "comment",
      "marginalia",
    ]);
    for (let index = 0; index < comments.length; ++index) {
      const first = comments[index];
      if (first === undefined) continue;
      let last = first;
      while (
        first.type === "comment" &&
        comments[index + 1]?.type === "comment"
      ) {
        const next = comments[index + 1];
        if (
          next === undefined ||
          !/^\r?\n[ \t]*$/u.test(
            this.source.content.slice(last.endIndex, next.startIndex),
          )
        )
          break;
        last = next;
        ++index;
      }
      const next = Array.from(this.nodes.keys())
        .filter((offset) => offset >= last.endIndex)
        .sort((a, b) => a - b)[0];
      const attached =
        next !== undefined &&
        /^[ \t]*$/u.test(
          this.source.content.slice(
            this.source.content.lastIndexOf("\n", first.startIndex - 1) + 1,
            first.startIndex,
          ),
        ) &&
        /^[ \t]*(?:\r?\n[ \t]*)?$/u.test(
          this.source.content.slice(last.endIndex, next),
        );
      const declarations = attached ? (this.nodes.get(next) ?? []) : [];
      const range = {
        start: this.session.range(first).start,
        end: this.session.range(last).end,
      };
      const doc: ISqlDocumentation = {
        id: `postgresql:${this.source.id}:documentation:${first.startIndex}`,
        range,
        attachments: declarations.map((declaration) => ({
          declarationId: declaration.id,
          siteId: declaration.site.id,
        })),
      };
      this.output.documentation.push(doc);
    }
  }

  /** Identifies parser extras without interpreting their contents as DDL. */
  private commentNode(node: Node): boolean {
    return node.type === "comment" || node.type === "marginalia";
  }

  /** Makes unsupported surface-changing syntax explicitly incomplete. */
  private problem(node: Node, message: string): void {
    this.output.complete = false;
    this.output.diagnostics.push({
      code: "postgresql-unsupported-syntax",
      severity: "error",
      message,
      repair:
        "Use explicit schema-qualified CREATE TABLE declarations and supported additive DDL, or implement this PostgreSQL construct before checking coverage.",
      location: {
        file: this.source.physicalPath,
        range: this.session.range(node),
      },
    });
  }
}
