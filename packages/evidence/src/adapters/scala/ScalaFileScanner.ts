import type { Node } from "web-tree-sitter";
import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { IScalaDeclaration } from "./IScalaDeclaration";
import type { IScalaDocumentation } from "./IScalaDocumentation";
import type { IScalaExport } from "./IScalaExport";
import type { IScalaFileAnalysis } from "./IScalaFileAnalysis";

/** Extracts explicit Scala 2/3 declarations while retaining unsupported surface boundaries. */
export class ScalaFileScanner {
  /** Node-free declaration records. */
  private readonly declarations: IScalaDeclaration[] = [];
  /** Scaladoc and unsupported tag carriers by original source offset. */
  private readonly documentation = new Map<number, IScalaDocumentation>();
  /** Explicit exports resolved after every selected file has been scanned. */
  private readonly exports: IScalaExport[] = [];
  /** Surface failures that prevent a passing smaller inventory. */
  private readonly diagnostics: IEvidenceDiagnostic[] = [];

  /** Borrows syntax only during the common parser callback. */
  public constructor(private readonly session: EvidenceParseSession, private readonly source: IEvidenceSourceFile) {}

  /** Produces a serializable inventory fragment. */
  public scan(): IScalaFileAnalysis {
    this.collectDocumentation();
    this.scope(this.session.root.namedChildren, [], undefined);
    return { source: this.source, declarations: this.declarations, documentation: [...this.documentation.values()], exports: this.exports, diagnostics: this.diagnostics, complete: this.diagnostics.length === 0 };
  }

  /** Walks declaration scopes without descending into executable bodies or local definitions. */
  private scope(nodes: Node[], namespace: string[], owner: IScalaDeclaration | undefined): void {
    let current = namespace;
    for (const node of nodes) {
      if (node.type === "package_clause") {
        const name = node.childForFieldName("name");
        const parts = name?.namedChildren.map((part) => this.name(part)) ?? [];
        const body = node.childForFieldName("body");
        if (body === null) current = [...current, ...parts];
        else this.scope(body.namedChildren, [...current, ...parts], owner);
      } else this.visit(node, current, owner);
    }
  }

  /** Selects source declarations and their explicit lexical children. */
  private visit(node: Node, namespace: string[], owner: IScalaDeclaration | undefined): void {
    if (["class_definition", "trait_definition", "object_definition", "enum_definition", "package_object"].includes(node.type)) {
      const declaration = this.declare(node, node.childForFieldName("name"), "type", namespace, owner);
      if (declaration === undefined) return;
      if (node.childForFieldName("derive") !== null && declaration.public)
        this.problem("derived-members", "Derives and uses clauses require generated-member resolution.", node);
      const parameterLists = node.childrenForFieldName("class_parameters");
      for (const [index, list] of parameterLists.entries())
        for (const parameter of list.namedChildren.filter((child) => child.type === "class_parameter"))
          if (parameter.children.some((child) => child.text === "val" || child.text === "var") || (index === 0 && node.children.some((child) => child.text === "case")))
            this.declare(parameter, parameter.childForFieldName("name"), "property", namespace, declaration);
      for (const body of node.childrenForFieldName("body")) this.scope(body.namedChildren, namespace, declaration);
      return;
    }
    if (["function_definition", "function_declaration"].includes(node.type)) {
      const name = node.childForFieldName("name");
      if (name?.text === "this") return;
      this.declare(node, name, "function", namespace, owner);
      return;
    }
    if (node.type === "type_definition") {
      this.declare(node, node.childForFieldName("name"), "type", namespace, owner);
      return;
    }
    if (["val_definition", "var_definition", "val_declaration", "var_declaration"].includes(node.type)) {
      const pattern = node.childForFieldName("pattern") ?? node.childForFieldName("name");
      if (pattern === null) this.problem("binding-pattern", "A value declaration has no static binding name.", node);
      else for (const name of this.bindings(pattern, node, owner)) this.declare(node, name, "property", namespace, owner);
      return;
    }
    if (node.type === "given_definition") {
      const declaration = this.declare(node, node.childForFieldName("name"), "property", namespace, owner);
      if (declaration === undefined) return;
      for (const body of node.childrenForFieldName("body"))
        if (["template_body", "with_template_body"].includes(body.type)) this.scope(body.namedChildren, namespace, declaration);
      return;
    }
    if (node.type === "extension_definition") {
      const before = this.declarations.length;
      this.scope(node.childrenForFieldName("body").filter((child) => child.isNamed), namespace, owner);
      for (const declaration of this.declarations.slice(before)) {
        if (declaration.ownerDeclarationId !== owner?.id) continue;
        const header = { start: this.session.range(node).start, end: this.session.range(node.childrenForFieldName("body")[0] ?? node).start };
        declaration.site.content = [header, ...declaration.site.content];
        this.attach(node, declaration);
      }
      return;
    }
    if (node.type === "enum_case_definitions") {
      for (const child of node.namedChildren.filter((part) => ["simple_enum_case", "full_enum_case"].includes(part.type))) {
        const name = child.childForFieldName("name") ?? child.namedChildren.find((part) => part.type === "identifier") ?? null;
        const full = child.namedChildren.some((part) => part.type === "class_parameters");
        const declaration = this.declare(child, name, full ? "type" : "property", namespace, owner);
        if (declaration === undefined) continue;
        this.attach(node, declaration);
        if (full) for (const list of child.namedChildren.filter((part) => part.type === "class_parameters"))
          for (const parameter of list.namedChildren.filter((part) => part.type === "class_parameter"))
            this.declare(parameter, parameter.childForFieldName("name"), "property", namespace, declaration);
      }
      return;
    }
    if (node.type === "export_declaration") {
      this.export(node, namespace, owner);
      return;
    }
    if (["comment", "block_comment", "import_declaration", "end_marker", "self_type"].includes(node.type)) return;
    if (owner?.public !== false && (node.type.endsWith("_definition") || node.type.endsWith("_declaration")))
      this.problem("unsupported-declaration", `Unsupported public Scala declaration '${node.type}'.`, node);
  }

  /** Retains only statically bound value names, including tuple and multi-name declarations. */
  private bindings(pattern: Node, node: Node, owner: IScalaDeclaration | undefined): Node[] {
    if (["identifier", "operator_identifier"].includes(pattern.type)) return pattern.text === "_" ? [] : [pattern];
    if (["identifiers", "tuple_pattern"].includes(pattern.type)) return pattern.namedChildren.flatMap((child) => this.bindings(child, node, owner));
    if (pattern.type === "wildcard") return [];
    if (this.visible(node, owner)) this.problem("binding-pattern", "Extractor and typed binding patterns require binding and stable-name resolution.", node);
    return [];
  }

  /** Creates one lexical declaration without synthesizing runtime/compiler members. */
  private declare(node: Node, nameNode: Node | null, symbol: EvidenceProgrammingSymbol, namespace: string[], owner: IScalaDeclaration | undefined, rename?: string): IScalaDeclaration | undefined {
    const visible = this.visible(node, owner);
    if (nameNode === null) {
      if (visible) this.problem("anonymous-given", "Anonymous givens require compiler-assigned names. Give the instance an explicit source name before addressing it.", node);
      return undefined;
    }
    const name = rename ?? this.name(nameNode);
    const object = node.type === "object_definition";
    const segment = object ? `object ${name}` : node.type === "package_object" ? `package object ${name}` : name;
    const address = [...(owner?.address ?? namespace), segment];
    const range = this.session.range(node);
    const siteId = `scala:${this.source.id}:site:${node.startIndex}:${node.endIndex}`;
    const declaration: IScalaDeclaration = {
      id: `${siteId}:${symbol}:${name}`, name, symbol, identity: address, address,
      lookup: [...(owner?.lookup ?? namespace), name],
      public: visible, object, syntax: node.type,
      site: { id: siteId, file: this.source.physicalPath, range, content: [range] },
      ...(owner === undefined ? {} : { ownerDeclarationId: owner.id }),
    };
    if (visible && node.descendantsOfType("macro_body").length !== 0)
      this.problem("macro", "Macro expansion is outside the explicit Scala source surface.", node);
    this.declarations.push(declaration);
    this.attach(node, declaration);
    return declaration;
  }

  /** Excludes every private/protected qualifier and restricted lexical owner. */
  private visible(node: Node, owner: IScalaDeclaration | undefined): boolean {
    const modifiers = node.namedChildren.find((child) => child.type === "modifiers");
    return owner?.public !== false && (modifiers === undefined || modifiers.descendantsOfType("access_modifier").length === 0);
  }

  /** Records named exports from selected singleton objects; dynamic/wildcard paths stay incomplete. */
  private export(node: Node, namespace: string[], owner: IScalaDeclaration | undefined): void {
    if (owner?.public === false) return;
    const path = node.childrenForFieldName("path").filter((child) => child.isNamed);
    const selectors = node.namedChildren.find((child) => child.type === "namespace_selectors");
    const renamed = node.namedChildren.find((child) => child.type === "as_renamed_identifier");
    const names = selectors?.namedChildren ?? (renamed === undefined ? path.slice(-1) : [renamed]);
    const qualifier = (selectors === undefined && renamed === undefined ? path.slice(0, -1) : path).map((part) => this.name(part));
    if (qualifier.length === 0 || node.descendantsOfType(["namespace_wildcard", "wildcard"]).length !== 0 || node.children.some((child) => child.text === "given")) {
      this.problem("export-resolution", "Only explicit named exports from selected singleton objects are supported; wildcard, given, and unqualified exports require member resolution.", node);
      return;
    }
    for (const selected of names) {
      const parts = ["as_renamed_identifier", "arrow_renamed_identifier"].includes(selected.type) ? selected.namedChildren : [selected];
      const member = parts[0];
      const alias = parts.at(-1);
      if (member === undefined || alias === undefined || !["identifier", "operator_identifier"].includes(member.type) || alias.text === "_") {
        this.problem("export-resolution", "This export selector requires unsupported name or given resolution.", node);
        continue;
      }
      const declaration = this.declare(node, member, "property", namespace, owner, this.name(alias));
      if (declaration === undefined) continue;
      declaration.public = false;
      const scope = owner?.lookup ?? namespace;
      const paths: string[][] = [];
      for (let length = scope.length; length >= 0; --length) paths.push([...scope.slice(0, length), ...qualifier]);
      this.exports.push({ declaration, paths, member: this.name(member) });
    }
  }

  /** Decodes backtick source names into literal accessor segments. */
  private name(node: Node): string { return node.text.startsWith("`") ? node.text.slice(1, -1) : node.text; }

  /** Attaches only adjacent Scaladoc across whitespace. */
  private attach(node: Node, declaration: IScalaDeclaration): void {
    const previous = node.previousNamedSibling;
    if (previous === null || previous.type !== "block_comment" || !previous.text.startsWith("/**") || !/^\s*$/u.test(this.source.content.slice(previous.endIndex, node.startIndex))) return;
    this.documentation.get(previous.startIndex)?.attachments.push({ declarationId: declaration.id, siteId: declaration.site.id });
  }

  /** Classifies comments and tag-bearing literal strings without treating them as declarations. */
  private collectDocumentation(): void {
    for (const node of this.session.root.descendantsOfType(["block_comment", "comment", "string"])) {
      const scaladoc = node.type === "block_comment" && node.text.startsWith("/**");
      if (!scaladoc && !/@(?:evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link|internal|hidden|ignore)\b/u.test(node.text)) continue;
      const opening = node.type === "block_comment" ? scaladoc ? "/**" : "/*" : node.type === "comment" ? "//" : node.text.startsWith('"""') ? '"""' : '"';
      this.documentation.set(node.startIndex, {
        id: `scala:${this.source.id}:documentation:${node.startIndex}`, range: this.session.range(node),
        syntax: { opening, closing: node.type === "block_comment" ? "*/" : node.type === "comment" ? "" : opening, ...(node.type === "block_comment" ? { linePrefix: "*" } : {}), tagBoundaries: true, allowWithdrawal: scaladoc }, attachments: [],
      });
    }
  }

  /** Reports an actionable incomplete-analysis boundary at the original syntax range. */
  private problem(code: string, message: string, node: Node): void {
    this.diagnostics.push({ code: `scala-${code}`, severity: "error", message, repair: "Use supported explicit Scala declarations or implement the reported source-resolution boundary before evaluating coverage.", location: { file: this.source.physicalPath, range: this.session.range(node) } });
  }
}
