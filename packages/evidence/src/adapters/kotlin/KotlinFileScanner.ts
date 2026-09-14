import type { Node } from "web-tree-sitter";

import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { IKotlinDeclaration } from "./IKotlinDeclaration";
import type { IKotlinDocumentation } from "./IKotlinDocumentation";
import type { IKotlinFileAnalysis } from "./IKotlinFileAnalysis";
import type { IKotlinTypeReference } from "./IKotlinTypeReference";

/**
 * Extracts lexical Kotlin declarations without executing scripts or compiler synthesis.
 *
 * The scanner retains package, import, receiver, and alias facts so the later
 * resolver can establish extension ownership without guessing from local syntax.
 */
export class KotlinFileScanner {
  /** Copied declarations retained after the parser callback ends. */
  private readonly declarations: IKotlinDeclaration[] = [];

  /** Documentation keyed by original start offset. */
  private readonly documentation = new Map<number, IKotlinDocumentation>();

  /** Failures that prevent a complete public denominator. */
  private readonly diagnostics: IEvidenceDiagnostic[] = [];

  /** Package segments used for snapshot-wide semantic identities. */
  private packagePath: string[] = [];

  /** Explicit import names used to normalize extension receivers. */
  private readonly imports = new Map<string, string[]>();

  /** Wildcard imports require dependency resolution for unknown receiver names. */
  private wildcardImport = false;

  /**
   * Borrows syntax and source only for the active parse callback.
   *
   * Source identity defines file-private lookup boundaries; serializable ranges
   * and paths outlive the session in the emitted analysis.
   */
  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
  ) {}

  /**
   * Returns serializable declarations and conservative boundary diagnostics.
   *
   * Import collection precedes declaration extraction because receiver lookup
   * preserves the source-defined alternatives and their order.
   */
  public scan(): IKotlinFileAnalysis {
    this.collectDocumentation();
    const packageNode = this.session.root.namedChildren.find(
      (node) => node.type === "package_header",
    );
    const packageName =
      packageNode === undefined
        ? undefined
        : packageNode.namedChildren.find(
            (node) => node.type === "qualified_identifier",
          );
    this.packagePath =
      packageName === undefined
        ? []
        : packageName.namedChildren.map((node) => this.name(node));
    for (const node of this.session.root.namedChildren.filter(
      (child) => child.type === "import",
    )) {
      const path = node.namedChildren.find(
        (child) => child.type === "qualified_identifier",
      );
      if (path === undefined) continue;
      if (node.children.some((child) => child.text === "*")) {
        this.wildcardImport = true;
        continue;
      }
      const parts = path.namedChildren.map((child) => this.name(child));
      const alias = node.namedChildren.find(
        (child) => child.type === "identifier",
      );
      const local = alias === undefined ? parts.at(-1) : this.name(alias);
      if (local !== undefined) this.imports.set(local, parts);
    }
    this.scope(this.session.root, undefined);
    return {
      source: this.source,
      declarations: this.declarations,
      documentation: [...this.documentation.values()],
      diagnostics: this.diagnostics,
      complete: this.diagnostics.length === 0,
    };
  }

  /** Visits declaration scopes, never local function bodies or initializer expressions. */
  private scope(body: Node, owner: IKotlinDeclaration | undefined): void {
    for (const node of body.namedChildren) {
      switch (node.type) {
        case "package_header":
        case "import":
        case "file_annotation":
        case "line_comment":
        case "block_comment":
        case "anonymous_initializer":
        case "secondary_constructor":
          break;
        case "annotated_expression":
          if (!this.detachedAnnotation(node))
            this.problem(
              "source-form",
              "A top-level annotated expression is not a declaration annotation.",
              node,
            );
          break;
        case "class_declaration":
        case "object_declaration":
        case "companion_object":
          this.nominal(node, owner);
          break;
        case "type_alias":
          this.add(node, node.childForFieldName("type"), "type", owner);
          break;
        case "function_declaration":
          this.add(node, node.childForFieldName("name"), "function", owner);
          break;
        case "property_declaration": {
          const variable = node.namedChildren.find(
            (child) => child.type === "variable_declaration",
          );
          if (variable === undefined) {
            if (this.visible(node, owner))
              this.problem(
                "destructuring",
                "Public destructuring requires component ownership that is not established by this adapter.",
                node,
              );
            break;
          }
          const declaration = this.add(
            node,
            variable.namedChildren.find(
              (child) => child.type === "identifier",
            ) ?? null,
            "property",
            owner,
          );
          if (declaration !== undefined)
            for (const accessor of node.namedChildren.filter(
              (child) => child.type === "getter" || child.type === "setter",
            ))
              this.attach(accessor, declaration);
          break;
        }
        case "enum_entry":
          this.add(
            node,
            node.namedChildren.find((child) => child.type === "identifier") ??
              null,
            "property",
            owner,
          );
          break;
        default:
          if (owner?.public !== false)
            this.problem(
              "source-form",
              `The declaration scope contains unsupported '${node.type}' syntax. Script execution and generated declarations are outside the source contract.`,
              node,
            );
      }
    }
  }

  /** Establishes nominal ownership before reading constructor properties and members. */
  private nominal(node: Node, owner: IKotlinDeclaration | undefined): void {
    const declaration = this.add(
      node,
      node.childForFieldName("name"),
      "type",
      owner,
      node.type === "companion_object" ? "Companion" : undefined,
    );
    if (declaration === undefined) return;
    const constructor = node.namedChildren.find(
      (child) => child.type === "primary_constructor",
    );
    const parameters =
      constructor === undefined
        ? undefined
        : constructor.namedChildren.find(
            (child) => child.type === "class_parameters",
          );
    for (const parameter of parameters === undefined
      ? []
      : parameters.namedChildren.filter(
          (child) => child.type === "class_parameter",
        ))
      if (
        parameter.children.some(
          (child) => child.text === "val" || child.text === "var",
        )
      )
        this.add(
          parameter,
          parameter.namedChildren.find(
            (child) => child.type === "identifier",
          ) ?? null,
          "property",
          declaration,
        );
    const body = node.namedChildren.find(
      (child) =>
        child.type === "class_body" || child.type === "enum_class_body",
    );
    if (body !== undefined) this.scope(body, declaration);
  }

  /** Records one declaration site and checks surface-changing header constructs. */
  private add(
    node: Node,
    nameNode: Node | null,
    symbol: EvidenceProgrammingSymbol,
    owner: IKotlinDeclaration | undefined,
    fallback?: string,
  ): IKotlinDeclaration | undefined {
    const name = nameNode === null ? fallback : this.name(nameNode);
    if (name === undefined) {
      if (this.visible(node, owner))
        this.problem(
          "declaration-name",
          "A public declaration has no statically addressable name.",
          node,
        );
      return undefined;
    }
    const visible = this.visible(node, owner);
    const modifiers = node.namedChildren.find(
      (child) => child.type === "modifiers",
    );
    const modifierWords =
      modifiers === undefined
        ? []
        : modifiers.namedChildren
            .filter((child) => child.type !== "annotation")
            .flatMap((child) => child.text.split(/\s+/u));
    if (visible) {
      if (modifierWords.some((word) => word === "expect" || word === "actual"))
        this.problem(
          "multiplatform",
          "Multiplatform expect/actual ownership requires source-set resolution.",
          node,
        );
      if (
        modifierWords.includes("override") &&
        !modifierWords.includes("public")
      )
        this.problem(
          "override-visibility",
          "An override without explicit visibility inherits base-member visibility, which this adapter cannot establish. Declare public visibility explicitly or implement base-member resolution.",
          node,
        );
      const delegation = node.namedChildren.find(
        (child) => child.type === "delegation_specifiers",
      );
      if (
        (delegation !== undefined &&
          delegation.descendantsOfType("explicit_delegation").length !== 0) ||
        node.namedChildren.some((child) => child.type === "property_delegate")
      )
        this.problem(
          "delegation",
          "Delegated members require generated-member and accessor ownership resolution.",
          node,
        );
    }
    const parameters = node.namedChildren.find(
      (child) => child.type === "type_parameters",
    );
    const typeParameters = [
      ...(owner?.typeParameters ?? []),
      ...(parameters === undefined
        ? []
        : parameters.namedChildren
            .filter((child) => child.type === "type_parameter")
            .flatMap((child) =>
              child.namedChildren
                .filter((part) => part.type === "identifier")
                .map((part) => this.name(part)),
            )),
    ];
    const receiverNode = this.receiver(node, nameNode);
    const receiver =
      receiverNode === undefined
        ? undefined
        : this.typeReference(receiverNode, owner, typeParameters);
    const aliasNode =
      node.type === "type_alias" ? node.namedChildren.at(-1) : undefined;
    const address = [
      ...(owner?.address ?? []),
      ...(receiver === undefined ? [] : ["extension"]),
      name,
    ];
    const prefix = this.annotationPrefix(node);
    const range: IEvidenceSourceRange = {
      start: this.session.range(prefix).start,
      end: this.session.range(node).end,
    };
    const siteId = `kotlin:${this.source.id}:site:${node.startIndex}:${node.endIndex}`;
    const declaration: IKotlinDeclaration = {
      id: `${siteId}:${symbol}:${name}`,
      name,
      symbol,
      typeParameters,
      ...(receiver === undefined ? {} : { receiver }),
      ...(aliasNode === undefined
        ? {}
        : {
            aliasTarget: this.typeReference(aliasNode, owner, typeParameters),
          }),
      identity: [...this.packagePath, ...address],
      address,
      public: visible,
      filePrivate:
        owner?.filePrivate === true || modifierWords.includes("private"),
      site: {
        id: siteId,
        file: this.source.physicalPath,
        range,
        content: [range],
      },
      ...(owner === undefined ? {} : { ownerDeclarationId: owner.id }),
    };
    this.declarations.push(declaration);
    this.attach(node, declaration);
    return declaration;
  }

  /** Applies lexical visibility without letting a restricted setter hide a property. */
  private visible(node: Node, owner: IKotlinDeclaration | undefined): boolean {
    const modifiers = node.namedChildren.find(
      (child) => child.type === "modifiers",
    );
    return (
      owner?.public !== false &&
      (modifiers === undefined ||
        !modifiers.namedChildren.some(
          (child) =>
            child.type === "visibility_modifier" && child.text !== "public",
        ))
    );
  }

  /** Separates extension declarations from ordinary members and other receiver types. */
  private receiver(node: Node, nameNode: Node | null): Node | undefined {
    if (
      node.type !== "function_declaration" &&
      node.type !== "property_declaration"
    )
      return undefined;
    const receiver = node.namedChildren.find(
      (child) =>
        [
          "user_type",
          "nullable_type",
          "parenthesized_type",
          "function_type",
          "non_nullable_type",
        ].includes(child.type) && child.endIndex <= (nameNode?.startIndex ?? 0),
    );
    return receiver;
  }

  /** Retains nominal lookup paths and makes unresolved type substitution explicit. */
  private typeReference(
    node: Node,
    owner: IKotlinDeclaration | undefined,
    typeParameters: string[],
  ): IKotlinTypeReference {
    const nullable = node.type === "nullable_type";
    const nominal = nullable
      ? node.namedChildren.find((child) => child.type === "user_type")
      : node;
    const names =
      nominal === undefined
        ? []
        : nominal.namedChildren
            .filter((child) => child.type === "identifier")
            .map((child) => this.name(child));
    const first = names[0];
    if (
      nominal === undefined ||
      nominal.type !== "user_type" ||
      first === undefined ||
      nominal.descendantsOfType("type_arguments").length !== 0 ||
      typeParameters.includes(first)
    )
      return {
        file: this.source.physicalPath,
        paths: [],
        nullable,
        problem:
          "Generic, type-parameter, function, and compound receivers require type substitution beyond nominal source resolution.",
      };
    const paths: string[][] = [];
    const scope = owner?.identity ?? this.packagePath;
    for (let length = scope.length; length > this.packagePath.length; --length)
      paths.push([...scope.slice(0, length), ...names]);
    const imported = this.imports.get(first);
    if (imported !== undefined) paths.push([...imported, ...names.slice(1)]);
    paths.push([...this.packagePath, ...names]);
    if (names.length > 1) paths.push(names);
    const core = [
      "Any",
      "Nothing",
      "Unit",
      "String",
      "Number",
      "Byte",
      "Short",
      "Int",
      "Long",
      "UByte",
      "UShort",
      "UInt",
      "ULong",
      "Float",
      "Double",
      "Boolean",
      "Char",
      "Throwable",
      "Annotation",
    ].includes(first);
    const external =
      imported !== undefined
        ? [...imported, ...names.slice(1)]
        : names.length > 1
          ? names
          : core && !this.wildcardImport
            ? ["kotlin", first]
            : undefined;
    return {
      file: this.source.physicalPath,
      paths,
      nullable,
      ...(external === undefined ? {} : { external }),
    };
  }

  /** Decodes Kotlin backtick names as literal accessor segments. */
  private name(node: Node): string {
    return node.text.startsWith("`") ? node.text.slice(1, -1) : node.text;
  }

  /** Attaches only adjacent KDoc; annotations are already part of the declaration node. */
  private attach(node: Node, declaration: IKotlinDeclaration): void {
    const prefix = this.annotationPrefix(node);
    const previous = prefix.previousNamedSibling;
    if (
      previous === null ||
      previous.type !== "block_comment" ||
      !previous.text.startsWith("/**")
    )
      return;
    if (
      !/^\s*$/u.test(
        this.source.content.slice(previous.endIndex, prefix.startIndex),
      )
    )
      return;
    const documentation = this.documentation.get(previous.startIndex);
    if (documentation !== undefined)
      documentation.attachments.push({
        declarationId: declaration.id,
        siteId: declaration.site.id,
      });
  }

  /** Includes annotation calls that the upstream grammar separates from a declaration. */
  private annotationPrefix(node: Node): Node {
    let prefix = node;
    while (
      prefix.previousNamedSibling !== null &&
      this.detachedAnnotation(prefix.previousNamedSibling)
    )
      prefix = prefix.previousNamedSibling;
    return prefix;
  }

  /** Recognizes only an annotation name immediately followed by its parenthesized argument. */
  private detachedAnnotation(node: Node): boolean {
    if (node.type !== "annotated_expression") return false;
    const children = node.namedChildren;
    const annotation = children[0];
    const argumentsNode = children[1];
    if (
      children.length !== 2 ||
      annotation?.type !== "annotation" ||
      argumentsNode?.type !== "parenthesized_expression" ||
      annotation.endIndex !== argumentsNode.startIndex
    )
      return false;
    const next = node.nextNamedSibling;
    return (
      next !== null &&
      [
        "class_declaration",
        "object_declaration",
        "function_declaration",
        "property_declaration",
        "type_alias",
      ].includes(next.type) &&
      /^\s*$/u.test(this.source.content.slice(node.endIndex, next.startIndex))
    );
  }

  /** Retains real KDoc and unsupported annotation carriers for truthful diagnostics. */
  private collectDocumentation(): void {
    for (const node of this.session.root.descendantsOfType([
      "block_comment",
      "line_comment",
      "string_literal",
      "multiline_string_literal",
    ])) {
      const kdoc = node.type === "block_comment" && node.text.startsWith("/**");
      if (
        !kdoc &&
        !/@(?:evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link|internal|hidden|ignore)\b/u.test(
          node.text,
        )
      )
        continue;
      const opening =
        node.type === "block_comment"
          ? kdoc
            ? "/**"
            : "/*"
          : node.type === "line_comment"
            ? "//"
            : node.text.startsWith('"""')
              ? '"""'
              : '"';
      const syntax: IEvidenceCommentSyntax = {
        opening,
        closing:
          node.type === "block_comment"
            ? "*/"
            : node.type === "line_comment"
              ? ""
              : opening,
        ...(node.type === "block_comment" ? { linePrefix: "*" } : {}),
        tagBoundaries: true,
        allowWithdrawal: kdoc,
      };
      this.documentation.set(node.startIndex, {
        id: `kotlin:${this.source.id}:documentation:${node.startIndex}`,
        range: this.session.range(node),
        syntax,
        attachments: [],
      });
    }
  }

  /** Keeps unsupported extraction visible to graph evaluation. */
  private problem(code: string, message: string, node: Node): void {
    this.diagnostics.push({
      code: `kotlin-${code}`,
      severity: "error",
      message,
      repair:
        "Select supported explicit Kotlin source or implement the reported semantic boundary before evaluating coverage.",
      location: {
        file: this.source.physicalPath,
        range: this.session.range(node),
      },
    });
  }
}
