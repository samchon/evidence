import typia from "typia";
import type { Node } from "web-tree-sitter";

import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { IZigDeclaration } from "./IZigDeclaration";
import type { IZigDocumentation } from "./IZigDocumentation";
import type { IZigFileAnalysis } from "./IZigFileAnalysis";

/** Reads declared Zig namespaces without evaluating build or comptime code. */
export class ZigFileScanner {
  /** Serializable declarations, including intentional alias projections. */
  private readonly declarations: IZigDeclaration[] = [];

  /** Documentation grouped by adjacent source lines. */
  private readonly documentation = new Map<number, IZigDocumentation>();

  /** Unsupported public forms that prevent a complete denominator. */
  private readonly diagnostics: IEvidenceDiagnostic[] = [];

  /** Borrows the real syntax tree for the bounded parser callback. */
  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
  ) {}

  /** Extracts explicit public declarations and classified annotation carriers. */
  public scan(): IZigFileAnalysis {
    this.collectDocumentation();
    this.scope(this.session.root, undefined, [], new Set<number>());
    return {
      source: this.source,
      declarations: this.declarations,
      documentation: [...this.documentation.values()],
      diagnostics: this.diagnostics,
      complete: this.diagnostics.length === 0,
    };
  }

  /** Visits only namespace members, excluding local function bodies and tests. */
  private scope(
    body: Node,
    owner: IZigDeclaration | undefined,
    canonical: string[],
    visited: Set<number>,
  ): void {
    for (const node of body.namedChildren) {
      if (node.type === "comment" || node.type === "test_declaration") continue;
      if (node.type === "comptime_declaration") {
        this.problem(
          "comptime",
          "Namespace comptime execution may change exported declarations and cannot be evaluated from source.",
          node,
        );
        continue;
      }
      const field = node.type === "container_field";
      if (
        field &&
        body.type === "enum_declaration" &&
        node.childForFieldName("name")?.text === "_"
      )
        continue;
      const visible =
        field || node.children.some((child) => child.text === "pub");
      if (node.type === "using_namespace_declaration") {
        // Private namespace imports can also participate in public name lookup.
        this.problem(
          "usingnamespace",
          "Namespace injection requires resolving all imported public members and lookup conflicts.",
          node,
        );
        continue;
      }
      if (!visible) continue;
      if (
        ![
          "variable_declaration",
          "function_declaration",
          "container_field",
        ].includes(node.type)
      ) {
        this.problem(
          "source-form",
          `Unsupported public Zig namespace member '${node.type}'.`,
          node,
        );
        continue;
      }
      this.declaration(node, body, owner, canonical, undefined, visited);
    }
  }

  /** Resolves bounded local aliases and establishes container ownership. */
  private declaration(
    node: Node,
    scope: Node,
    owner: IZigDeclaration | undefined,
    canonical: string[],
    exposed: string | undefined,
    visited: Set<number>,
  ): IZigDeclaration | undefined {
    if (visited.has(node.startIndex)) {
      this.problem(
        "alias-cycle",
        "A public alias has cyclic local declaration ownership.",
        node,
      );
      return undefined;
    }
    const next = new Set(visited).add(node.startIndex);
    const nameNode =
      node.childForFieldName("name") ??
      node.namedChildren.find((child) => child.type === "identifier");
    if (
      nameNode === undefined ||
      nameNode === null ||
      nameNode.type !== "identifier"
    ) {
      this.problem(
        "declaration-name",
        "A public field or declaration has no supported literal name; tuple fields require numeric ownership.",
        node,
      );
      return undefined;
    }
    const name = this.name(nameNode);
    const duplicates = scope.namedChildren.filter((child) => {
      const candidate =
        child.childForFieldName("name") ??
        (child.type === "variable_declaration"
          ? child.namedChildren.find((part) => part.type === "identifier")
          : undefined);
      return (
        candidate !== null &&
        candidate !== undefined &&
        this.name(candidate) === name
      );
    });
    if (duplicates.length > 1)
      this.problem(
        "duplicate-name",
        "This public namespace contains conflicting declarations with the same name.",
        node,
      );
    const address = [...(owner?.address ?? []), exposed ?? name];
    const initializer = this.initializer(node);
    const declaredType = node.childForFieldName("type");
    if (
      node.type === "variable_declaration" &&
      (declaredType === null || declaredType.text === "type") &&
      node.children.some((child) => child.text === "const") &&
      initializer?.type === "identifier"
    ) {
      const matches = scope.namedChildren.filter(
        (child) =>
          ["variable_declaration", "function_declaration"].includes(
            child.type,
          ) &&
          this.sameName(
            child.childForFieldName("name") ??
              child.namedChildren.find((part) => part.type === "identifier"),
            initializer,
          ),
      );
      const target = matches[0];
      if (matches.length !== 1 || target === undefined) {
        this.problem(
          "alias-unresolved",
          "The public alias does not resolve to one declaration in its lexical container.",
          node,
        );
        return undefined;
      }
      if (this.scalar(target, scope, new Set<number>()))
        return this.add(
          node,
          name,
          "property",
          owner,
          [...canonical, name],
          address,
          false,
        );
      const original = this.declaration(
        target,
        scope,
        owner,
        canonical,
        exposed ?? name,
        next,
      );
      if (original === undefined) return undefined;
      const alias = this.add(
        node,
        original.name,
        original.symbol,
        owner,
        original.identity,
        address,
        true,
      );
      return alias;
    }
    const container =
      initializer !== undefined && CONTAINERS.has(initializer.type)
        ? initializer
        : undefined;
    const primitiveType =
      initializer !== undefined && TYPE_FORMS.has(initializer.type);
    const symbol: EvidenceProgrammingSymbol =
      node.type === "container_field"
        ? "property"
        : node.type === "function_declaration"
          ? "function"
          : container !== undefined ||
              primitiveType ||
              declaredType?.text === "type"
            ? "type"
            : "property";
    const declaration = this.add(
      node,
      name,
      symbol,
      owner,
      [...canonical, name],
      address,
      exposed !== undefined,
    );
    if (node.type === "function_declaration") {
      const returnType = node.childForFieldName("type");
      const parameters = node.namedChildren.find(
        (child) => child.type === "parameters",
      );
      const generic =
        parameters?.namedChildren?.some((parameter) =>
          parameter.children.some(
            (child) => child.text === "comptime" || child.text === "anytype",
          ),
        ) ?? false;
      if (
        (returnType !== null &&
          this.metaType(returnType, scope, new Set<number>())) ||
        (returnType !== null &&
          (returnType.descendantsOfType([
            ...CONTAINERS,
            "builtin_function",
            "call_expression",
            "if_type_expression",
          ]).length !== 0 ||
            [
              ...CONTAINERS,
              "builtin_function",
              "call_expression",
              "if_type_expression",
            ].includes(returnType.type))) ||
        (generic && returnType?.type !== "builtin_type")
      )
        this.problem(
          "type-producing-function",
          "Public type-producing or dependent generic return types require comptime instantiation to establish their reachable members.",
          node,
        );
      return declaration;
    }
    if (
      primitiveType &&
      initializer !== undefined &&
      initializer.descendantsOfType([
        ...CONTAINERS,
        "builtin_function",
        "call_expression",
        "if_type_expression",
      ]).length !== 0
    )
      this.problem(
        "compound-type",
        "A compound public type contains anonymous or computed members requiring static ownership resolution.",
        node,
      );
    if (container !== undefined) {
      if (container.type === "error_set_declaration") {
        for (const member of container.namedChildren.filter(
          (child) => child.type === "identifier",
        )) {
          const memberName = this.name(member);
          this.add(
            member,
            memberName,
            "property",
            declaration,
            [...declaration.identity, memberName],
            [...address, memberName],
            false,
          );
        }
      } else this.scope(container, declaration, declaration.identity, next);
    } else if (initializer?.type === "anonymous_struct_initializer") {
      this.problem(
        "anonymous-value",
        "Anonymous aggregate values require inferred field and tuple ownership; declare an explicit named container.",
        node,
      );
    } else if (
      initializer !== undefined &&
      declaredType === null &&
      !VALUE_FORMS.has(initializer.type) &&
      !primitiveType
    ) {
      this.problem(
        "inferred-surface",
        "An inferred public value may expose a type, namespace, or generated members. Import, conditional, call, and comptime expressions require static ownership resolution.",
        node,
      );
    } else if (
      declaredType?.text === "type" &&
      container === undefined &&
      !primitiveType
    ) {
      this.problem(
        "generated-type",
        "A public type value requires resolving its complete member surface without executing comptime code.",
        node,
      );
    }
    if (
      declaredType !== null &&
      ([
        ...CONTAINERS,
        "builtin_function",
        "call_expression",
        "if_type_expression",
      ].includes(declaredType.type) ||
        declaredType.descendantsOfType([
          ...CONTAINERS,
          "builtin_function",
          "call_expression",
          "if_type_expression",
        ]).length !== 0)
    )
      this.problem(
        "anonymous-field-type",
        "An anonymous or computed public declaration type requires nested member ownership; give the type an explicit declaration.",
        node,
      );
    return declaration;
  }

  /** Recognizes aliases of the metatype in function return positions without execution. */
  private metaType(node: Node, scope: Node, visited: Set<number>): boolean {
    if (node.text === "type") return true;
    if (node.type !== "identifier" || visited.has(node.startIndex))
      return false;
    visited.add(node.startIndex);
    const target = scope.namedChildren.find(
      (child) =>
        child.type === "variable_declaration" &&
        this.sameName(
          child.namedChildren.find((part) => part.type === "identifier"),
          node,
        ),
    );
    const initializer =
      target === undefined ? undefined : this.initializer(target);
    return (
      initializer !== undefined && this.metaType(initializer, scope, visited)
    );
  }

  /** Distinguishes copied scalar values from identity-preserving namespace aliases. */
  private scalar(node: Node, scope: Node, visited: Set<number>): boolean {
    if (visited.has(node.startIndex) || node.type !== "variable_declaration")
      return false;
    visited.add(node.startIndex);
    const declared = node.childForFieldName("type");
    if (declared !== null)
      return declared.type === "builtin_type" && declared.text !== "type";
    const initializer = this.initializer(node);
    if (initializer === undefined) return false;
    if (VALUE_FORMS.has(initializer.type)) return true;
    if (initializer.type !== "identifier") return false;
    const matches = scope.namedChildren.filter(
      (child) =>
        child.type === "variable_declaration" &&
        this.sameName(
          child.namedChildren.find((part) => part.type === "identifier"),
          initializer,
        ),
    );
    const target = matches[0];
    return (
      matches.length === 1 &&
      target !== undefined &&
      this.scalar(target, scope, visited)
    );
  }

  /** Copies one physical declaration and its public path before the tree is released. */
  private add(
    node: Node,
    name: string,
    symbol: EvidenceProgrammingSymbol,
    owner: IZigDeclaration | undefined,
    identity: string[],
    address: string[],
    alias: boolean,
  ): IZigDeclaration {
    const range = this.session.range(node);
    const siteId = `zig:${this.source.id}:site:${node.startIndex}:${node.endIndex}`;
    const declaration: IZigDeclaration = {
      id: `${siteId}:${JSON.stringify(address)}`,
      name,
      symbol,
      identity,
      address,
      public: true,
      alias,
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

  /** Identifies a declaration initializer from syntax delimiters rather than source regexes. */
  private initializer(node: Node): Node | undefined {
    const equals = node.children.find((child) => child.type === "=");
    return equals === undefined
      ? undefined
      : node.namedChildren.find(
          (child) =>
            child.startIndex >= equals.endIndex && child.type !== "comment",
        );
  }

  /** Compares equivalent bare and quoted spellings by their decoded identifier. */
  private sameName(left: Node | null | undefined, right: Node): boolean {
    return (
      left !== undefined &&
      left !== null &&
      this.name(left) === this.name(right)
    );
  }

  /** Decodes literal Zig identifiers, preserving dots as a single accessor segment. */
  private name(node: Node): string {
    if (!node.text.startsWith('@"')) return node.text;
    try {
      const parsed: unknown = JSON.parse(node.text.slice(1));
      return typia.assert<string>(parsed);
    } catch {
      this.problem(
        "identifier-escape",
        "This quoted identifier uses an unsupported Zig escape; use a literal UTF-8 name or implement its escape decoding.",
        node,
      );
      return node.text;
    }
  }

  /** Attaches an adjacent /// group to its declaration, never to strings or ordinary comments. */
  private attach(node: Node, declaration: IZigDeclaration): void {
    const previous = node.previousNamedSibling;
    if (
      previous === null ||
      previous.type !== "comment" ||
      !previous.text.startsWith("///") ||
      previous.text.startsWith("////")
    )
      return;
    if (
      !/^\s*$/u.test(
        this.source.content.slice(previous.endIndex, node.startIndex),
      )
    )
      return;
    const documentation = [...this.documentation.values()].find(
      (item) =>
        item.range.end.offset === previous.endIndex &&
        item.syntax.opening === "///",
    );
    if (documentation === undefined) return;
    if (
      !documentation.attachments.some(
        (attachment) => attachment.declarationId === declaration.id,
      )
    )
      documentation.attachments.push({
        declarationId: declaration.id,
        siteId: declaration.site.id,
      });
  }

  /** Classifies real comments and tag-bearing strings while retaining UTF-16 positions. */
  private collectDocumentation(): void {
    const nodes = this.session.root.descendantsOfType([
      "comment",
      "string",
      "multiline_string",
    ]);
    const consumed = new Set<number>();
    for (const node of nodes) {
      if (consumed.has(node.startIndex)) continue;
      const doc =
        node.type === "comment" &&
        node.text.startsWith("///") &&
        !node.text.startsWith("////");
      if (
        !doc &&
        !/@(?:evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link|internal|hidden|ignore)\b/u.test(
          node.text,
        )
      )
        continue;
      let end = node;
      if (doc) {
        let next = end.nextNamedSibling;
        while (
          next !== null &&
          next.type === "comment" &&
          next.text.startsWith("///") &&
          !next.text.startsWith("////") &&
          /^[ \t]*\r?\n[ \t]*$/u.test(
            this.source.content.slice(end.endIndex, next.startIndex),
          )
        ) {
          consumed.add(next.startIndex);
          end = next;
          next = end.nextNamedSibling;
        }
      }
      const opening = doc
        ? "///"
        : node.type === "comment"
          ? node.text.startsWith("//!")
            ? "//!"
            : "//"
          : node.type === "multiline_string"
            ? "\\\\"
            : '"';
      this.documentation.set(node.startIndex, {
        id: `zig:${this.source.id}:documentation:${node.startIndex}`,
        range: {
          start: this.session.range(node).start,
          end: this.session.range(end).end,
        },
        syntax: {
          opening,
          closing: node.type === "string" ? '"' : "",
          ...(doc ? { linePrefix: "///" } : {}),
          tagBoundaries: true,
          allowWithdrawal: doc,
        },
        attachments: [],
      });
    }
  }

  /** Makes unsupported namespace semantics actionable and incomplete. */
  private problem(code: string, message: string, node: Node): void {
    if (
      this.diagnostics.some(
        (item) =>
          item.code === `zig-${code}` &&
          item.location?.range?.start?.offset === node.startIndex,
      )
    )
      return;
    this.diagnostics.push({
      code: `zig-${code}`,
      severity: "error",
      message,
      repair:
        "Use explicit supported Zig declarations or implement the reported static resolution before evaluating coverage.",
      location: {
        file: this.source.physicalPath,
        range: this.session.range(node),
      },
    });
  }
}

const CONTAINERS = new Set([
  "struct_declaration",
  "enum_declaration",
  "union_declaration",
  "opaque_declaration",
  "error_set_declaration",
]);
const TYPE_FORMS = new Set([
  "builtin_type",
  "nullable_type",
  "slice_type",
  "pointer_type",
  "array_type",
  "error_union_type",
  "function_signature",
]);
const VALUE_FORMS = new Set([
  "integer",
  "float",
  "boolean",
  "character",
  "string",
  "multiline_string",
]);
