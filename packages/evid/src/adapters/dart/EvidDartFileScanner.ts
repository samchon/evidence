import type { Node as EvidNode } from "web-tree-sitter";

import type { EvidParseSession } from "../../parsers/EvidParseSession";
import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";
import type { IEvidDartDeclaration } from "./IEvidDartDeclaration";
import type { IEvidDartDirective } from "./IEvidDartDirective";
import type { IEvidDartDocumentation } from "./IEvidDartDocumentation";
import type { IEvidDartFileAnalysis } from "./IEvidDartFileAnalysis";

/**
 * Extracts explicit Dart declarations while leaving library topology to snapshot resolution.
 *
 * The scanner owns parser-bound nodes for one source only. It emits declarations,
 * directives, and documentation as independent records so parts and exported
 * aliases can be reconciled across the selected snapshot.
 */
export class EvidDartFileScanner {
  /**
   * Retains node-free declarations beyond the parser session.
   *
   * The adapter consumes these records after the parser callback has closed.
   */
  private readonly declarations: IEvidDartDeclaration[] = [];

  /**
   * Stores documentation keyed by the final comment node of each group.
   *
   * Group identity lets adjacent DartDoc lines become one source carrier.
   */
  private readonly documentation = new Map<number, IEvidDartDocumentation>();

  /**
   * Stores unsupported source boundaries that prevent complete analysis.
   *
   * These diagnostics preserve failed extraction rather than omitting declarations.
   */
  private readonly diagnostics: IEvidDiagnostic[] = [];

  /**
   * Stores static part and export relationships.
   *
   * EvidDartLibraries resolves this topology after every selected file is scanned.
   */
  private readonly directives: IEvidDartDirective[] = [];

  /**
   * Borrows the active parser session and immutable source.
   *
   * The session supplies syntax and ranges, while source identity is copied into
   * records that remain valid after the parser callback closes.
   */
  public constructor(
    private readonly session: EvidParseSession,
    private readonly source: IEvidSourceFile,
  ) {}

  /**
   * Establishes physical declarations, documentation ownership, and source boundaries.
   *
   * Documentation is collected first so adjacency is decided from original
   * source positions before directives and declarations consume the tree.
   */
  public scan(): IEvidDartFileAnalysis {
    this.collectDocumentation();
    this.scope(this.session.root, undefined);
    if (this.directives.some((directive) => directive.kind === "part-of"))
      for (const node of this.session.root.namedChildren)
        if (node.type === "import_or_export" || node.type === "library_name")
          this.problem(
            "part-directives",
            "A part cannot contain import, export, or library directives.",
            node,
          );
    const library = this.session.root.namedChildren.find(
      (node) => node.type === "library_name",
    );
    const libraryNode =
      library === undefined
        ? undefined
        : library.namedChildren.find(
            (node) => node.type === "dotted_identifier_list",
          );
    const libraryName =
      libraryNode === undefined ? undefined : this.qualifiedName(libraryNode);
    return {
      source: this.source,
      library: this.source.physicalPath,
      ...(libraryName === undefined ? {} : { libraryName }),
      declarations: this.declarations,
      documentation: [...new Set(this.documentation.values())],
      directives: this.directives,
      diagnostics: this.diagnostics,
      complete: this.diagnostics.length === 0,
    };
  }

  /**
   * Visits library and nominal scopes without entering initializers or function bodies.
   *
   * Executable code cannot add a stable declaration to the static public surface.
   */
  private scope(body: EvidNode, owner: IEvidDartDeclaration | undefined): void {
    for (const node of body.namedChildren) {
      switch (node.type) {
        case "comment":
        case "documentation_comment":
        case "script_tag":
          break;
        case "library_name":
          if (node.children.some((child) => child.text === "augment"))
            this.problem(
              "augmentation",
              "Library augmentation requires generated-source ownership resolution.",
              node,
            );
          break;
        case "import_or_export": {
          const exported = node.namedChildren.find(
            (child) => child.type === "library_export",
          );
          if (exported !== undefined) this.directive(exported, "export");
          break;
        }
        case "part_directive":
          this.directive(node, "part");
          break;
        case "part_of_directive":
          this.directive(node, "part-of");
          break;
        case "class_declaration":
        case "mixin_declaration":
        case "enum_declaration":
        case "extension_declaration":
        case "extension_type_declaration":
          this.nominal(node, owner);
          break;
        case "type_alias":
          this.add(
            node,
            node.namedChildren.find((child) => child.type === "type_identifier")
              ?.text,
            "type",
            owner,
            "alias",
          );
          break;
        case "enum_constant":
          this.add(
            node,
            node.childForFieldName("name")?.text,
            "property",
            owner,
            "field",
          );
          break;
        case "class_member":
          this.member(node, owner);
          break;
        case "function_declaration":
        case "getter_declaration":
        case "setter_declaration":
        case "external_function_declaration":
        case "external_getter_declaration":
        case "external_setter_declaration":
          this.signature(node, node.childForFieldName("signature"), owner);
          break;
        case "top_level_variable_declaration":
        case "external_variable_declaration":
          this.variables(node, node, owner);
          break;
        default:
          if (owner?.public !== false)
            this.problem(
              "source-form",
              `Unsupported declaration-scope syntax '${node.type}' can change the public surface.`,
              node,
            );
      }
    }
  }

  /**
   * Gives named extensions their own owner while unnamed extensions remain library-local.
   *
   * This preserves Dart's distinct public address rules for extension members.
   */
  private nominal(node: EvidNode, owner: IEvidDartDeclaration | undefined): void {
    let name = node.childForFieldName("name");
    if (name?.type === "extension_type_name")
      name =
        name.namedChildren.find((child) => child.type === "identifier") ?? null;
    const application = node.namedChildren.find(
      (child) => child.type === "mixin_application_class",
    );
    if (application !== undefined)
      name =
        application.namedChildren.find(
          (child) => child.type === "identifier",
        ) ?? null;
    if (node.type === "extension_declaration" && name === null) return;
    const declaration = this.add(node, name?.text, "type", owner, "nominal");
    if (declaration === undefined) return;
    const representation = node.childForFieldName("representation");
    if (representation !== null)
      this.add(
        representation,
        representation.childForFieldName("name")?.text,
        "property",
        declaration,
        "field",
      );
    const body = node.childForFieldName("body");
    if (body !== null) this.scope(body, declaration);
  }

  /**
   * Unwraps class members while preserving metadata and documentation on the whole declaration.
   *
   * Attachments must remain on the declaration that defines the public unit.
   */
  private member(node: EvidNode, owner: IEvidDartDeclaration | undefined): void {
    const declaration = node.namedChildren.find(
      (child) =>
        child.type === "declaration" || child.type === "method_declaration",
    );
    if (declaration === undefined) {
      this.problem(
        "member",
        "A class member has no recognized declaration.",
        node,
      );
      return;
    }
    let signature = declaration.childForFieldName("signature");
    if (signature?.type === "method_signature")
      signature =
        signature.namedChildren.find((child) =>
          child.type.endsWith("_signature"),
        ) ?? null;
    if (signature === null)
      signature =
        declaration.namedChildren.find((child) =>
          child.type.endsWith("_signature"),
        ) ?? null;
    if (signature !== null) this.signature(node, signature, owner);
    else this.variables(node, declaration, owner);
  }

  /**
   * Treats getters and setters as one property and explicit constructors or operators as functions.
   *
   * The classification determines the public selector emitted for the declaration.
   */
  private signature(
    node: EvidNode,
    signature: EvidNode | null,
    owner: IEvidDartDeclaration | undefined,
  ): void {
    if (signature === null) {
      this.problem(
        "signature",
        "A callable has no recognized signature.",
        node,
      );
      return;
    }
    const getter = signature.type === "getter_signature";
    // The pinned grammar also parses an omitted-return-type setter as a function returning `set`.
    const setter =
      signature.type === "setter_signature" ||
      (signature.type === "function_signature" &&
        signature.childForFieldName("return_type")?.text === "set");
    let name = signature.childForFieldName("name")?.text;
    if (signature.type.includes("constructor")) {
      const identifiers = signature.namedChildren.filter(
        (child) => child.type === "identifier",
      );
      name = identifiers[1]?.text ?? "new";
    }
    if (signature.type === "operator_signature")
      name = `operator ${signature.childForFieldName("operator")?.text ?? ""}`;
    this.add(
      node,
      name,
      getter || setter ? "property" : "function",
      owner,
      getter ? "getter" : setter ? "setter" : "callable",
    );
  }

  /**
   * Reads only declarator lists, never identifiers nested in initializer expressions.
   *
   * This prevents referenced names from becoming false variable declarations.
   */
  private variables(
    node: EvidNode,
    declaration: EvidNode,
    owner: IEvidDartDeclaration | undefined,
  ): void {
    const list = declaration.namedChildren.find((child) =>
      [
        "initialized_identifier_list",
        "static_final_declaration_list",
        "identifier_list",
      ].includes(child.type),
    );
    if (list === undefined) {
      if (owner?.public !== false)
        this.problem(
          "variables",
          "A field declaration has no recognized static declarator list.",
          node,
        );
      return;
    }
    for (const variable of list.namedChildren.filter(
      (child) => child.type !== "comment",
    ))
      this.add(
        node,
        variable.type === "identifier"
          ? variable.text
          : variable.childForFieldName("name")?.text,
        "property",
        owner,
        "field",
      );
  }

  /**
   * Records an explicit declaration and its original UTF-16 content range.
   *
   * Later documentation attachment needs the physical declaration site.
   */
  private add(
    node: EvidNode,
    name: string | undefined,
    symbol: EvidProgrammingSymbol,
    owner: IEvidDartDeclaration | undefined,
    role: string,
  ): IEvidDartDeclaration | undefined {
    if (name === undefined) {
      this.problem(
        "declaration-name",
        "A declaration has no statically addressable name.",
        node,
      );
      return undefined;
    }
    const visible = owner?.public !== false && !name.startsWith("_");
    if (
      visible &&
      (node.children.some((child) => child.text === "augment") ||
        node.namedChildren.some((child) =>
          child.children.some((part) => part.text === "augment"),
        ))
    )
      this.problem(
        "augmentation",
        "Augmented declarations require generated-source ownership resolution.",
        node,
      );
    const address = [...(owner?.address ?? []), name];
    const range = this.session.range(node);
    const siteId = `dart:${this.source.id}:site:${node.startIndex}:${node.endIndex}`;
    const declaration: IEvidDartDeclaration = {
      id: `${siteId}:${symbol}:${name}`,
      name,
      symbol,
      role,
      library: this.source.physicalPath,
      identity: address,
      address,
      public: visible,
      site: {
        id: siteId,
        file: this.source.physicalPath,
        range,
        content: [range],
      },
      ...(owner === undefined ? {} : { ownerDeclarationId: owner.id }),
    };
    this.declarations.push(declaration);
    const previous = node.previousNamedSibling;
    if (
      previous !== null &&
      /^\s*$/u.test(
        this.source.content.slice(previous.endIndex, node.startIndex),
      )
    ) {
      const documentation = this.documentation.get(previous.startIndex);
      if (documentation !== undefined && documentation.syntax.allowWithdrawal)
        documentation.attachments.push({
          declarationId: declaration.id,
          siteId,
        });
    }
    return declaration;
  }

  /**
   * Copies static URI relationships and ordered export filters.
   *
   * Library resolution applies filters in source order to determine exported names.
   */
  private directive(node: EvidNode, kind: IEvidDartDirective["kind"]): void {
    const named = node.namedChildren.find(
      (child) => child.type === "dotted_identifier_list",
    );
    const targetNode =
      node.childForFieldName("uri") ??
      node.namedChildren.find((child) => child.type === "uri");
    const uri =
      targetNode === undefined
        ? undefined
        : targetNode.descendantsOfType("string_literal")[0];
    const raw = uri?.text;
    if (
      node.descendantsOfType("configuration_uri").length !== 0 ||
      (raw !== undefined && !/^(?:'[^'\\$]*'|"[^"\\$]*")$/u.test(raw))
    ) {
      this.problem(
        "directive-uri",
        "Conditional, interpolated, or escaped library URIs need resolution beyond the static selected snapshot.",
        node,
      );
      return;
    }
    const target =
      named === undefined
        ? raw === undefined
          ? undefined
          : raw.slice(1, -1)
        : this.qualifiedName(named);
    if (target === undefined) {
      this.problem(
        "directive-uri",
        "A library directive has no static target.",
        node,
      );
      return;
    }
    this.directives.push({
      kind,
      target,
      named: named !== undefined,
      filters: node.namedChildren
        .filter((child) => child.type === "combinator")
        .map((child) => ({
          kind: child.children[0]?.text === "show" ? "show" : "hide",
          names: child.namedChildren
            .filter((part) => part.type === "identifier")
            .map((part) => part.text),
        })),
      range: this.session.range(node),
    });
  }

  /**
   * Normalizes a named library from identifier segments rather than source whitespace.
   *
   * Segment-based identity keeps comments and formatting out of the semantic name.
   */
  private qualifiedName(node: EvidNode): string {
    return node.namedChildren
      .filter((child) => child.type === "identifier")
      .map((child) => child.text)
      .join(".");
  }

  /**
   * Groups adjacent DartDoc comments and retains unsupported annotation carriers.
   *
   * Detached carriers remain available for a truthful host diagnostic.
   */
  private collectDocumentation(): void {
    const nodes = this.session.root.descendantsOfType([
      "comment",
      "documentation_comment",
      "string_literal",
    ]);
    for (const node of nodes) {
      const line = node.text.startsWith("///");
      const block = node.text.startsWith("/**");
      if (
        !line &&
        !block &&
        !/@(?:evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link|internal|hidden|ignore)\b/u.test(
          node.text,
        )
      )
        continue;
      const previous = node.previousNamedSibling;
      const prior =
        previous === null
          ? undefined
          : this.documentation.get(previous.startIndex);
      if (
        line &&
        previous !== null &&
        previous.text.startsWith("///") &&
        prior !== undefined &&
        /^[ \t]*\r?\n[ \t]*$/u.test(
          this.source.content.slice(previous.endIndex, node.startIndex),
        )
      ) {
        prior.range.end = this.session.range(node).end;
        this.documentation.set(node.startIndex, prior);
        continue;
      }
      const opening = line
        ? "///"
        : block
          ? "/**"
          : node.text.startsWith("//")
            ? "//"
            : node.text.startsWith("/*")
              ? "/*"
              : (node.text.match(/^(?:r)?(?:'''|"""|'|")/u)?.[0] ?? "");
      this.documentation.set(node.startIndex, {
        id: `dart:${this.source.id}:documentation:${node.startIndex}`,
        range: this.session.range(node),
        syntax: {
          opening,
          closing: opening.startsWith("/*")
            ? "*/"
            : opening.startsWith("//")
              ? ""
              : opening.replace(/^r/u, ""),
          ...(opening.startsWith("/*")
            ? { linePrefix: "*" }
            : line
              ? { linePrefix: "///" }
              : {}),
          tagBoundaries: true,
          allowWithdrawal: line || block,
        },
        attachments: [],
      });
    }
  }

  /**
   * Preserves unsupported source as an actionable incomplete inventory.
   *
   * A failed scan cannot make coverage pass with a reduced public population.
   */
  private problem(code: string, message: string, node: EvidNode): void {
    this.diagnostics.push({
      code: `dart-${code}`,
      severity: "error",
      message,
      repair:
        "Select supported explicit Dart declarations or implement the reported source boundary before checking coverage.",
      location: {
        file: this.source.physicalPath,
        range: this.session.range(node),
      },
    });
  }
}
