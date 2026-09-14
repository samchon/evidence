import type { Node } from "web-tree-sitter";

import { BigQueryColumnType } from "./BigQueryColumnType";
import { BigQueryIdentifier } from "./BigQueryIdentifier";
import { BigQueryString } from "./BigQueryString";
import { BigQueryWithdrawals } from "./BigQueryWithdrawals";
import type { ISqlDeclaration } from "../sql/ISqlDeclaration";
import type { ISqlFileAnalysis } from "../sql/ISqlFileAnalysis";
import { SourceText } from "../../internal/SourceText";
import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { EvidenceDatabaseSymbol } from "../../typings/EvidenceDatabaseSymbol";

/** Establishes GoogleSQL declaration ownership before interpreting documentation. */
export class BigQueryFileScanner {
  /** Serializable output owned by this file analysis. */
  private readonly output: ISqlFileAnalysis;

  /** Maps original source offsets without normalizing line endings. */
  private readonly text: SourceText;

  /** Borrows the completed GoogleSQL tree for this scan only. */
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
    };
    this.text = new SourceText(source.content);
  }

  /** Extracts explicit tables and rejects every other statement that could alter schema. */
  public scan(): ISqlFileAnalysis {
    for (const node of this.session.root.namedChildren) {
      if (node.type === "comment") continue;
      if (node.type === "create_table_statement") this.table(node);
      else
        this.fail(
          node,
          `The ${node.type} statement is outside the explicit CREATE TABLE schema surface.`,
        );
    }
    const comments = this.session
      .captures("(comment) @comment")
      .map((capture) => capture.node);
    for (let index = 0; index < comments.length; ++index) {
      const first = comments[index];
      if (first === undefined) continue;
      let last = first;
      const prefix = first.text.startsWith("--")
        ? "--"
        : first.text.startsWith("#")
          ? "#"
          : undefined;
      while (prefix !== undefined) {
        const next = comments[index + 1];
        if (
          next === undefined ||
          !next.text.startsWith(prefix) ||
          !/^[ \t\r]*\n[ \t]*$/u.test(
            this.source.content.slice(last.endIndex, next.startIndex),
          )
        )
          break;
        last = next;
        ++index;
      }
      this.comment(first, last);
    }
    for (const documentation of this.output.documentation) {
      const sites = new Set(
        documentation.attachments.map((attachment) => attachment.siteId),
      );
      documentation.attachments = this.output.declarations
        .filter((declaration) => sites.has(declaration.site.id))
        .map((declaration) => ({
          declarationId: declaration.id,
          siteId: declaration.site.id,
        }));
    }
    BigQueryWithdrawals.apply(this.output);
    return this.output;
  }

  /** Publishes a table only when its schema is completely declared in source. */
  private table(node: Node): void {
    const name = node.childForFieldName("table_name");
    const parameters = node.namedChildren.find(
      (child) => child.type === "create_table_parameters",
    );
    if (
      name === null ||
      parameters === undefined ||
      node.namedChildren.some((child) => child.type === "query_statement") ||
      !/^CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?TABLE\b/iu.test(
        node.text,
      )
    ) {
      this.fail(
        node,
        "Query-derived tables and views need a fully declared CREATE TABLE schema without AS, LIKE, COPY, or CLONE.",
      );
      return;
    }
    const path = BigQueryIdentifier.table(name.text);
    if (path === undefined) {
      this.fail(
        name,
        "The table identifier cannot be represented as an explicit project.dataset.table path.",
      );
      return;
    }
    if (
      node.namedChildren.some(
        (child) =>
          child.type === "keyword_replace" ||
          child.type === "keyword_if_not_exists",
      )
    ) {
      this.fail(
        node,
        "Conditional or replacing CREATE TABLE depends on prior database state.",
      );
      return;
    }
    const model = this.declare(
      node,
      path,
      "model",
      undefined,
      !node.namedChildren.some((child) => child.type === "keyword_temporary"),
    );
    this.options(node, model);
    const columns = parameters.namedChildren.filter(
      (child) => child.type === "column_definition",
    );
    const primaryKeys =
      this.session.captures("(primary_key) @primary", parameters).length +
      columns.filter(
        (column) =>
          column.childForFieldName("constraint_clause")?.type === "PRIMARY_KEY",
      ).length;
    if (primaryKeys > 1)
      this.fail(
        parameters,
        "A BigQuery table can declare only one primary key.",
      );
    for (const column of columns) this.column(column, model, path);
    for (const constraint of parameters.namedChildren.filter(
      (child) => child.type === "constraint_definition",
    ))
      this.constraint(constraint, model, columns);
  }

  /** Nested STRUCT fields retain a field path and the table's schema ownership. */
  private column(
    node: Node,
    model: ISqlDeclaration,
    ownerPath: string[],
  ): void {
    const identifier = node.childForFieldName("column_name");
    const name =
      identifier === null
        ? undefined
        : BigQueryIdentifier.column(identifier.text);
    const type = node.childForFieldName("column_type");
    if (name === undefined || type === null) {
      this.fail(
        node,
        "The schema field needs an explicit supported name and type.",
      );
      return;
    }
    const path = [...ownerPath, name];
    if (!BigQueryColumnType.supported(type))
      this.fail(
        type,
        "This field type is outside the declared GoogleSQL scalar, STRUCT, and ARRAY type surface.",
      );
    const column = this.declare(node, path, "column", model, model.public);
    if (
      ownerPath.length !== model.address.length &&
      node.childForFieldName("constraint_clause") !== null
    )
      this.fail(
        node,
        "Primary and foreign key constraints cannot be declared on STRUCT or ARRAY elements.",
      );
    this.options(node, column);
    for (const nested of type.namedChildren.filter(
      (child) => child.type === "column_definition",
    ))
      this.column(nested, model, path);
    const reference = node.namedChildren.find(
      (child) => child.type === "foreign_key_references",
    );
    if (reference !== undefined) {
      if (ownerPath.length !== model.address.length)
        this.fail(node, "Foreign keys must belong to top-level table fields.");
      else this.relation(node, reference, model, [name], undefined);
    }
    this.enforcement(node);
  }

  /** Primary keys constrain columns; only foreign keys create relation units. */
  private constraint(
    node: Node,
    model: ISqlDeclaration,
    columns: Node[],
  ): void {
    this.enforcement(node);
    const key = node.namedChildren.find(
      (child) => child.type === "foreign_key" || child.type === "primary_key",
    );
    if (key === undefined) {
      this.fail(
        node,
        "This constraint has no supported declared primary or foreign key.",
      );
      return;
    }
    const list = key.childForFieldName("column_list");
    const names =
      list === null
        ? []
        : list.namedChildren.map((child) =>
            BigQueryIdentifier.canonicalColumn(child.text),
          );
    const available = columns
      .map((column) => column.childForFieldName("column_name"))
      .map((name) =>
        name === null
          ? undefined
          : BigQueryIdentifier.canonicalColumn(name.text),
      );
    if (
      names.length === 0 ||
      names.some((name) => name === undefined || !available.includes(name)) ||
      new Set(names).size !== names.length
    ) {
      this.fail(
        node,
        "Key columns must identify distinct explicitly declared top-level fields in the owning table.",
      );
      return;
    }
    if (key.type === "primary_key") return;
    const reference = key.namedChildren.find(
      (child) => child.type === "foreign_key_references",
    );
    if (reference === undefined) {
      this.fail(
        node,
        "The foreign key has no explicit referenced table and columns.",
      );
      return;
    }
    const identifier = node.childForFieldName("constraint_name");
    const constraintName =
      identifier === null
        ? undefined
        : BigQueryIdentifier.member(identifier.text);
    if (identifier !== null && constraintName === undefined) {
      this.fail(
        identifier,
        "The named foreign key uses an unsupported identifier escape or qualification.",
      );
      return;
    }
    this.relation(
      node,
      reference,
      model,
      names.filter((name) => name !== undefined),
      constraintName,
    );
  }

  /** Gives anonymous composite keys endpoint-based identity, independent of statement order. */
  private relation(
    node: Node,
    reference: Node,
    model: ISqlDeclaration,
    columns: string[],
    name: string | undefined,
  ): void {
    const target = reference.childForFieldName("referenced_table_name");
    const path =
      target === null ? undefined : BigQueryIdentifier.table(target.text);
    const list = reference.childForFieldName("referenced_column_list");
    const endpoints =
      list === null
        ? []
        : list.namedChildren.map((child) =>
            BigQueryIdentifier.canonicalColumn(child.text),
          );
    if (
      path === undefined ||
      endpoints.length !== columns.length ||
      endpoints.some((part) => part === undefined) ||
      new Set(endpoints).size !== endpoints.length
    ) {
      this.fail(
        node,
        "Foreign keys require explicit table paths and equally sized, distinct column endpoints.",
      );
      return;
    }
    const relationName =
      name ??
      `foreign key ${JSON.stringify([columns.map((column) => column.toLowerCase()), path, endpoints])}`;
    const declaration = this.declare(
      node,
      [...model.address, relationName],
      "relation",
      model,
      model.public,
    );
    declaration.identity = [
      ...model.identity,
      name === undefined ? relationName : name.toLowerCase(),
    ];
  }

  /** BigQuery key constraints are declarations and cannot claim enforcement. */
  private enforcement(node: Node): void {
    for (const capture of this.session.captures(
      "(constraint_enfoce_option) @enforcement",
      node,
    ))
      if (!/^NOT\s+ENFORCED$/iu.test(capture.node.text))
        this.fail(
          capture.node,
          "GoogleSQL key declarations must say NOT ENFORCED.",
        );
  }

  /** Reads only OPTIONS description strings attached to this exact declaration. */
  private options(node: Node, declaration: ISqlDeclaration): void {
    const clause = node.namedChildren.find(
      (child) => child.type === "option_clause",
    );
    if (clause === undefined) return;
    const descriptions = clause.namedChildren.filter(
      (child) =>
        child.type === "option_item" &&
        BigQueryIdentifier.canonical(
          child.childForFieldName("key")?.text ?? "",
        ) === "description",
    );
    if (descriptions.length > 1)
      this.fail(
        clause,
        "Each declaration can have only one OPTIONS description.",
      );
    for (const item of descriptions) {
      const value = item.childForFieldName("value");
      const mapped =
        value?.type === "string"
          ? BigQueryString.read(value.text, value.startIndex)
          : undefined;
      if (value === null || value === undefined || mapped === undefined) {
        this.fail(
          item,
          "OPTIONS description requires one supported static GoogleSQL string literal.",
        );
        continue;
      }
      this.output.documentation.push({
        id: `${declaration.id}:description`,
        range: this.session.range(value),
        mapped,
        attachments: [
          { declarationId: declaration.id, siteId: declaration.site.id },
        ],
      });
    }
  }

  /** Attaches adjacent real comments, leaving embedded examples and string contents inert. */
  private comment(node: Node, last: Node): void {
    const following = this.output.declarations
      .filter(
        (declaration) => declaration.site.range.start.offset >= last.endIndex,
      )
      .sort(
        (left, right) =>
          left.site.range.start.offset - right.site.range.start.offset,
      )[0];
    const gap =
      following === undefined
        ? ""
        : this.source.content.slice(
            last.endIndex,
            following.site.range.start.offset,
          );
    const attached =
      following !== undefined && /^\s*$/u.test(gap) && !/\n\s*\n/u.test(gap);
    const opening = node.text.startsWith("/*")
      ? "/*"
      : node.text.startsWith("--")
        ? "--"
        : "#";
    this.output.documentation.push({
      id: `${this.source.id}:comment:${node.startIndex}`,
      range: this.text.range(node.startIndex, last.endIndex),
      syntax: {
        opening,
        closing: opening === "/*" ? "*/" : "",
        linePrefix: opening === "/*" ? "*" : opening,
        tagBoundaries: true,
        allowWithdrawal: attached,
      },
      attachments: attached
        ? [{ declarationId: following.id, siteId: following.site.id }]
        : [],
    });
  }

  /** Constructs a serializable site with exact source ranges. */
  private declare(
    node: Node,
    path: string[],
    symbol: EvidenceDatabaseSymbol,
    owner: ISqlDeclaration | undefined,
    visible: boolean,
  ): ISqlDeclaration {
    const id = `${this.source.id}:${symbol}:${node.startIndex}:${JSON.stringify(path)}`;
    const range = this.text.range(node.startIndex, node.endIndex);
    const identity =
      owner === undefined
        ? path
        : path.map((part, index) =>
            index < owner.address.length ? part : part.toLowerCase(),
          );
    const declaration: ISqlDeclaration = {
      id,
      name: path.at(-1) ?? "",
      symbol,
      identity,
      address: path,
      site: {
        id: `${this.source.id}:site:${node.startIndex}:${node.endIndex}`,
        file: this.source.physicalPath,
        range,
        content: [range],
      },
      ...(owner === undefined ? {} : { ownerDeclarationId: owner.id }),
      public: visible,
    };
    this.output.declarations.push(declaration);
    return declaration;
  }

  /** Keeps unsupported schema-changing syntax from producing a passing smaller inventory. */
  private fail(node: Node, message: string): void {
    this.output.complete = false;
    this.output.diagnostics.push({
      code: "bigquery-unsupported-syntax",
      severity: "error",
      message,
      repair:
        "Select explicit GoogleSQL CREATE TABLE declarations with supported fields, descriptions, and NOT ENFORCED keys, or add extraction support for this construct.",
      location: {
        file: this.source.physicalPath,
        range: this.session.range(node),
      },
    });
  }
}
