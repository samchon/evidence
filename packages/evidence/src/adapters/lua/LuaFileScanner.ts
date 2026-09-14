import type { Node } from "web-tree-sitter";

import { SourceText } from "../../internal/SourceText";
import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { ILuaDeclaration } from "./ILuaDeclaration";
import type { ILuaDocumentation } from "./ILuaDocumentation";
import type { ILuaFileAnalysis } from "./ILuaFileAnalysis";
import type { ILuaValue } from "./ILuaValue";

/** Resolves an explicit, non-executing Lua module initialization convention. */
export class LuaFileScanner {
  /** Lexical chunk bindings, including private locals. */
  private readonly bindings = new Map<string, ILuaValue>();

  /** Chunk globals form the public surface independently of returned tables. */
  private readonly globals = new Map<string, ILuaValue>();

  /** Values exported by the final literal table return. */
  private returned: ILuaValue | undefined;

  /** Serializable public declarations and alias projections. */
  private readonly declarations: ILuaDeclaration[] = [];

  /** Original comment carriers keyed by their final comment offset. */
  private readonly documentation = new Map<number, ILuaDocumentation>();

  /** Unsupported surface-changing constructs keep the inventory incomplete. */
  private readonly diagnostics: IEvidenceDiagnostic[] = [];

  /** Borrows the tree only for the active parser callback. */
  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
  ) {}

  /** Establishes values and ownership before attaching documentation. */
  public scan(): ILuaFileAnalysis {
    this.comments();
    for (const node of this.session.root.namedChildren) this.statement(node);
    if (this.returned !== undefined)
      this.publish(this.returned, ["module"], undefined, new Set());
    for (const [name, value] of this.globals)
      this.publish(value, [name], undefined, new Set());
    this.deferredMutations();
    return {
      source: this.source,
      declarations: this.declarations,
      documentation: [...new Set(this.documentation.values())],
      diagnostics: this.diagnostics,
      complete: this.diagnostics.length === 0,
    };
  }

  /** Accepts deterministic initialization statements without running application code. */
  private statement(node: Node): void {
    if (["comment", "hash_bang_line", "empty_statement"].includes(node.type))
      return;
    if (node.type === "function_declaration") {
      const name = node.childForFieldName("name");
      if (name === null)
        return this.problem(node, "A function needs a static name.");
      this.assign(
        name,
        this.value(node, node),
        node.children.some((child) => child.type === "local"),
        node,
      );
      return;
    }
    if (
      node.type === "variable_declaration" ||
      node.type === "assignment_statement"
    ) {
      const assignment =
        node.type === "variable_declaration"
          ? node.namedChildren.find(
              (child) => child.type === "assignment_statement",
            )
          : node;
      if (assignment === undefined) {
        this.problem(
          node,
          "Uninitialized bindings require later mutation; initialize each binding explicitly.",
        );
        return;
      }
      const names =
        assignment.namedChildren
          .find((child) => child.type === "variable_list")
          ?.namedChildren.filter((child) => child.type !== "comment") ?? [];
      const values =
        assignment.namedChildren
          .find((child) => child.type === "expression_list")
          ?.namedChildren.filter((child) => child.type !== "comment") ?? [];
      if (
        names.length !== 1 ||
        values.length !== 1 ||
        names[0] === undefined ||
        values[0] === undefined
      ) {
        this.problem(
          node,
          "Multiple assignment and attributed bindings require Lua value-adjustment semantics.",
        );
        return;
      }
      this.assign(
        names[0],
        this.value(values[0], node),
        node.children.some((child) => child.type === "local"),
        node,
      );
      return;
    }
    if (node.type === "return_statement") {
      const values =
        node.namedChildren
          .find((child) => child.type === "expression_list")
          ?.namedChildren.filter((child) => child.type !== "comment") ?? [];
      const value =
        values.length === 1 && values[0] !== undefined
          ? this.value(values[0], node)
          : undefined;
      if (value?.kind !== "table")
        this.problem(
          node,
          "The module convention requires one literal table or a resolved local table return.",
        );
      else this.returned = value;
      return;
    }
    this.problem(
      node,
      `Chunk-level '${node.type}' can change exports through execution; use explicit static initialization.`,
    );
  }

  /** Resolves literal values and already-established aliases. */
  private value(node: Node, site: Node): ILuaValue | undefined {
    if (node.type === "parenthesized_expression") {
      const child = node.namedChildren.find((item) => item.type !== "comment");
      return child === undefined ? undefined : this.value(child, site);
    }
    if (
      [
        "identifier",
        "dot_index_expression",
        "bracket_index_expression",
      ].includes(node.type)
    ) {
      const path = this.path(node);
      let value =
        path === undefined ? undefined : this.bindings.get(path[0] ?? "");
      for (const segment of path?.slice(1) ?? [])
        value = value?.fields.get(segment);
      if (value === undefined)
        this.problem(
          node,
          "An alias or return depends on an unresolved binding; require loaders and external tables are not evaluated.",
        );
      // Scalar assignment copies a value; table and function aliases retain identity.
      return value?.kind === "literal" || value?.kind === "nil"
        ? { ...value, node: site, fields: new Map() }
        : value;
    }
    if (["function_declaration", "function_definition"].includes(node.type))
      return { kind: "function", node: site, fields: new Map() };
    if (["number", "string", "true", "false", "nil"].includes(node.type))
      return {
        kind: node.type === "nil" ? "nil" : "literal",
        node: site,
        fields: new Map(),
      };
    if (
      node.type === "unary_expression" &&
      node.childForFieldName("operator")?.text === "-" &&
      node.namedChildren
        .filter((child) => child.type !== "comment")
        .some((child) => child.type === "number")
    )
      return { kind: "literal", node: site, fields: new Map() };
    if (node.type === "table_constructor") {
      const value: ILuaValue = { kind: "table", node: site, fields: new Map() };
      for (const field of node.namedChildren.filter(
        (child) => child.type !== "comment",
      )) {
        const key = field.childForFieldName("name");
        const expression = field.childForFieldName("value");
        const name =
          key === null ||
          (field.children[0]?.type === "[" && key.type !== "string")
            ? undefined
            : this.key(key);
        if (
          field.type !== "field" ||
          name === undefined ||
          expression === null
        ) {
          this.problem(
            field,
            "Table exports require named or string-literal fields; computed, numeric, and positional keys are unsupported.",
          );
          continue;
        }
        const child = this.value(expression, field);
        if (child !== undefined) this.field(value, name, child, field);
      }
      return value;
    }
    this.problem(
      node,
      `Export initialization '${node.type}' is not a static literal, function, table, or resolved alias.`,
    );
    return undefined;
  }

  /** Defines one binding or a previously absent literal table member. */
  private assign(
    name: Node,
    value: ILuaValue | undefined,
    local: boolean,
    site: Node,
  ): void {
    const path = this.path(name);
    if (path === undefined || value === undefined) return;
    const first = path[0];
    if (first === undefined) return;
    if (["_G", "_ENV", "module"].includes(first)) {
      this.problem(
        name,
        "Environment writes and the reserved module accessor are outside the bounded module convention.",
      );
      return;
    }
    if (path.length === 1) {
      if (this.bindings.has(first)) {
        this.problem(
          site,
          `Reassignment or shadowing of '${first}' can change public identity.`,
        );
        return;
      }
      this.bindings.set(first, value);
      if (!local) this.globals.set(first, value);
      return;
    }
    let owner = this.bindings.get(first);
    for (const segment of path.slice(1, -1)) owner = owner?.fields.get(segment);
    const last = path.at(-1);
    if (owner?.kind !== "table" || last === undefined) {
      this.problem(
        name,
        "A dot or colon declaration requires a previously initialized local table owner.",
      );
      return;
    }
    this.field(owner, last, value, site);
  }

  /** Rejects replacement instead of keeping an obsolete declaration denominator. */
  private field(
    owner: ILuaValue,
    name: string,
    value: ILuaValue,
    node: Node,
  ): void {
    if (owner.fields.has(name))
      this.problem(
        node,
        `Table field '${name}' is defined more than once; replacement is outside static declaration support.`,
      );
    else if (value.kind !== "nil") owner.fields.set(name, value);
  }

  /** Reads exact accessor segments; numeric keys are deliberately not conflated with strings. */
  private path(node: Node): string[] | undefined {
    if (node.type === "identifier") return [node.text];
    if (
      [
        "dot_index_expression",
        "method_index_expression",
        "bracket_index_expression",
      ].includes(node.type)
    ) {
      const table = node.childForFieldName("table");
      const key =
        node.childForFieldName("field") ?? node.childForFieldName("method");
      const prefix = table === null ? undefined : this.path(table);
      const name =
        key === null ||
        (node.type === "bracket_index_expression" && key.type !== "string")
          ? undefined
          : this.key(key);
      if (prefix !== undefined && name !== undefined) return [...prefix, name];
    }
    this.problem(
      node,
      "A declaration needs identifier or literal string accessor segments.",
    );
    return undefined;
  }

  /** Preserves literal dotted names and rejects escape-dependent names explicitly. */
  private key(node: Node): string | undefined {
    if (node.type === "identifier") return node.text;
    if (node.type !== "string") return undefined;
    const quote = node.text[0];
    if ((quote === '"' || quote === "'") && !node.text.includes("\\"))
      return node.text.slice(1, -1);
    const long = /^\[(=*)\[([\s\S]*)\]\1\]$/u.exec(node.text);
    if (long !== null)
      return (long[2] ?? "").replace(/^\r?\n/u, "").replace(/\r\n?/gu, "\n");
    this.problem(
      node,
      "Escaped field names need a Lua byte-string decoder; use an unescaped string key.",
    );
    return undefined;
  }

  /** Publishes aliases with one canonical identity and explicit table ownership. */
  private publish(
    value: ILuaValue,
    address: string[],
    owner: ILuaDeclaration | undefined,
    ancestors: Set<ILuaValue>,
  ): void {
    if (value.kind === "nil") return;
    if (ancestors.has(value)) {
      this.problem(
        value.node,
        "Cyclic table exports cannot be represented by finite public accessor paths.",
      );
      return;
    }
    let declaration = value.declaration;
    if (declaration === undefined) {
      const id = `lua:${this.source.id}:${value.node.startIndex}`;
      declaration = {
        id,
        name: address.at(-1) ?? "module",
        symbol: value.kind === "function" ? "function" : "property",
        identity: address,
        address,
        site: {
          id: `${id}:site`,
          file: this.source.physicalPath,
          range: this.session.range(value.node),
          content: [this.session.range(value.node)],
        },
        public: true,
        ...(owner === undefined ? {} : { ownerDeclarationId: owner.id }),
      };
      value.declaration = declaration;
      this.attach(value.node, declaration);
    }
    this.declarations.push({ ...declaration, address });
    const next = new Set(ancestors).add(value);
    for (const [name, field] of value.fields)
      this.publish(field, [...address, name], declaration, next);
  }

  /** Reports deferred writes to exported bindings and table escapes inside functions. */
  private deferredMutations(): void {
    for (const fn of this.session.root.descendantsOfType([
      "function_declaration",
      "function_definition",
    ])) {
      const body = fn.childForFieldName("body");
      if (body === null) continue;
      for (const declaration of body.descendantsOfType(
        "variable_declaration",
      )) {
        const values = declaration.descendantsOfType("expression_list")[0];
        if (values !== undefined && this.tableReferences(values, declaration))
          this.problem(
            declaration,
            "A deferred local alias can mutate an exported table; local alias flow is outside static module initialization.",
          );
      }
      for (const assignment of body.descendantsOfType("assignment_statement")) {
        if (assignment.parent?.type === "variable_declaration") continue;
        const names = assignment.namedChildren.find(
          (child) => child.type === "variable_list",
        );
        for (const name of names?.namedChildren ?? []) {
          const root =
            name.descendantsOfType("identifier")[0]?.text ?? name.text;
          if (this.local(root, assignment)) continue;
          if (
            this.bindings.get(root)?.declaration !== undefined ||
            root === "self" ||
            root === "_G" ||
            root === "_ENV" ||
            !this.bindings.has(root)
          )
            this.problem(
              assignment,
              "A function writes a public or unresolved binding; deferred export mutation requires runtime analysis.",
            );
        }
      }
      for (const declaration of body.descendantsOfType(
        "function_declaration",
      )) {
        if (declaration.children.some((child) => child.type === "local"))
          continue;
        const name = declaration.childForFieldName("name");
        const root =
          name?.descendantsOfType("identifier")[0]?.text ?? name?.text;
        if (root !== undefined && !this.local(root, declaration))
          this.problem(
            declaration,
            "A deferred function declaration changes an external table or global binding.",
          );
      }
      for (const call of body.descendantsOfType("function_call")) {
        const args = call.childForFieldName("arguments");
        if (args !== null && this.tableReferences(args, call))
          this.problem(
            call,
            "An exported table escapes to a function call that may mutate its surface.",
          );
      }
    }
  }

  /** Distinguishes passing a table from reading its known scalar or callable fields. */
  private tableReferences(container: Node, site: Node): boolean {
    for (const node of container.descendantsOfType([
      "identifier",
      "dot_index_expression",
      "bracket_index_expression",
    ])) {
      const parent = node.parent;
      if (
        parent !== null &&
        [
          "dot_index_expression",
          "method_index_expression",
          "bracket_index_expression",
        ].includes(parent.type)
      )
        continue;
      const root = node.descendantsOfType("identifier")[0]?.text ?? node.text;
      if (this.local(root, site)) continue;
      if (root === "self") return true;
      let value = this.bindings.get(root);
      if (value?.kind !== "table" || value.declaration === undefined) continue;
      const path = this.path(node);
      if (path === undefined) return true;
      for (const segment of path.slice(1)) value = value?.fields.get(segment);
      if (value === undefined || value.kind === "table") return true;
    }
    return false;
  }

  /** Resolves function parameters and preceding lexical locals without conflating sibling scopes. */
  private local(name: string, node: Node): boolean {
    let scope = node.parent;
    while (scope !== null && scope.type !== "chunk") {
      if (
        ["function_declaration", "function_definition"].includes(scope.type)
      ) {
        const parameters = scope.childForFieldName("parameters");
        if (
          parameters?.namedChildren.some(
            (child) => child.type === "identifier" && child.text === name,
          )
        )
          return true;
      }
      if (scope.type === "block")
        for (const declaration of scope.namedChildren) {
          if (declaration.startIndex >= node.startIndex) break;
          if (declaration.type === "variable_declaration") {
            const names = declaration.descendantsOfType("variable_list")[0];
            if (
              names?.namedChildren.some(
                (child) => child.type === "identifier" && child.text === name,
              )
            )
              return true;
          }
          if (
            declaration.type === "function_declaration" &&
            declaration.children.some((child) => child.type === "local") &&
            declaration.childForFieldName("name")?.text === name
          )
            return true;
        }
      scope = scope.parent;
    }
    return false;
  }

  /** Groups adjacent LuaDoc line comments and recognizes long documentation comments. */
  private comments(): void {
    const source = new SourceText(this.source.content);
    for (const node of this.session.root.descendantsOfType([
      "comment",
      "string",
    ])) {
      const text = node.text;
      const long = /^--\[(=*)\[/u.exec(text);
      const line =
        node.type === "comment" && text.startsWith("---") && long === null;
      const eligible = line || long !== null;
      if (
        !eligible &&
        !/@(?:evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link|internal|hidden|ignore)\b/u.test(
          text,
        )
      )
        continue;
      const previous = node.previousNamedSibling;
      const existing =
        line &&
        previous?.type === "comment" &&
        previous.text.startsWith("---") &&
        /^\s*$/u.test(
          this.source.content.slice(previous.endIndex, node.startIndex),
        )
          ? this.documentation.get(previous.startIndex)
          : undefined;
      if (existing !== undefined) {
        existing.range = source.range(
          existing.range.start.offset,
          node.endIndex,
        );
        this.documentation.set(node.startIndex, existing);
        continue;
      }
      const opening =
        long?.[0] ??
        (line
          ? "---"
          : node.type === "comment"
            ? "--"
            : text.startsWith("[")
              ? (/^\[=*\[/u.exec(text)?.[0] ?? "")
              : (text[0] ?? ""));
      const closing =
        long !== null
          ? `]${long[1] ?? ""}]`
          : node.type === "comment"
            ? ""
            : opening.startsWith("[")
              ? opening.replace(/\[/gu, "]")
              : opening;
      this.documentation.set(node.startIndex, {
        id: `lua:${this.source.id}:documentation:${node.startIndex}`,
        range: this.session.range(node),
        syntax: {
          opening,
          closing,
          ...(line ? { linePrefix: "---" } : {}),
          tagBoundaries: true,
          allowWithdrawal: eligible,
        },
        attachments: [],
      });
    }
  }

  /** Attaches LuaDoc only to its immediately following static declaration. */
  private attach(node: Node, declaration: ILuaDeclaration): void {
    const previous = node.previousNamedSibling;
    if (
      previous?.type !== "comment" ||
      !(previous.text.startsWith("---") || /^--\[=*\[/u.test(previous.text))
    )
      return;
    if (
      !/^\s*$/u.test(
        this.source.content.slice(previous.endIndex, node.startIndex),
      )
    )
      return;
    this.documentation.get(previous.startIndex)?.attachments.push({
      declarationId: declaration.id,
      siteId: declaration.site.id,
    });
  }

  /** Retains actionable source locations for every unproven public surface. */
  private problem(node: Node, message: string): void {
    this.diagnostics.push({
      code: "lua-dynamic-surface",
      severity: "error",
      message,
      repair:
        "Use the explicit Lua module/table convention or implement this semantic boundary before evaluating coverage.",
      location: {
        file: this.source.physicalPath,
        range: this.session.range(node),
      },
    });
  }
}
