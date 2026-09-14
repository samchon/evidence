import type { Node } from "web-tree-sitter";

import { SourceText } from "../../internal/SourceText";
import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { IPhpDeclaration } from "./IPhpDeclaration";
import type { IPhpDocumentation } from "./IPhpDocumentation";
import type { IPhpFileAnalysis } from "./IPhpFileAnalysis";

/** Extracts explicit PHP declarations without executing source or resolving runtime loaders. */
export class PhpFileScanner {
  /** Serializable declarations collected in lexical order. */
  private readonly declarations: IPhpDeclaration[] = [];

  /** PHPDoc carriers, including unsupported attachment positions. */
  private readonly documentation = new Map<number, IPhpDocumentation>();

  /** Failures that prevent a complete declared surface. */
  private readonly diagnostics: IEvidenceDiagnostic[] = [];

  /** Original UTF-16 source coordinate mapping. */
  private readonly text: SourceText;

  /** Owns one borrowed parser session and source snapshot. */
  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
  ) {
    this.text = new SourceText(source.content);
  }

  /** Extracts namespaces, nominal types, functions, and public members. */
  public scan(): IPhpFileAnalysis {
    for (const comment of this.session.root.descendantsOfType("comment")) {
      if (!comment.text.startsWith("/**")) continue;
      this.documentation.set(comment.startIndex, {
        id: `php:${this.source.id}:documentation:${comment.startIndex}`,
        range: this.session.range(comment),
        syntax: {
          opening: "/**",
          closing: "*/",
          linePrefix: "*",
          tagBoundaries: true,
          allowWithdrawal: true,
        },
        attachments: [],
      });
    }
    if (this.session.root.descendantsOfType("php_tag").length === 0)
      this.problem(
        this.session.root,
        "source-policy",
        "PHP source requires an opening <?php tag; tagless PHP-only files are not selected by this adapter.",
      );
    this.scanScope(this.session.root, [], undefined);
    this.dynamicSurface(this.session.root);
    return {
      source: this.source,
      declarations: this.declarations,
      documentation: [...this.documentation.values()],
      diagnostics: this.diagnostics,
      context: this.session.root
        .descendantsOfType(["namespace_use_declaration", "declare_directive"])
        .map((node) => node.text.replaceAll("\r\n", "\n")),
      complete: this.diagnostics.length === 0,
    };
  }

  /** Tracks semicolon and bracketed namespace scopes without fabricating namespace units. */
  private scanScope(
    node: Node,
    initial: string[],
    owner: IPhpDeclaration | undefined,
  ): void {
    let namespace = initial;
    for (const child of node.namedChildren) {
      if (child.type === "namespace_definition") {
        const name = child.childForFieldName("name");
        const segments =
          name === null
            ? []
            : name.descendantsOfType("name").map((part) => part.text);
        const body = child.childForFieldName("body");
        if (body === null) namespace = segments;
        else this.scanScope(body, segments, undefined);
      } else if (TYPES.has(child.type)) {
        const declaration = this.add(child, child, "type", namespace, owner);
        const body = child.childForFieldName("body");
        if (declaration !== undefined && body !== null)
          this.scanScope(body, namespace, declaration);
      } else if (
        child.type === "function_definition" ||
        child.type === "method_declaration"
      ) {
        this.add(child, child, "function", namespace, owner);
        const methodName = child.childForFieldName("name");
        if (
          owner !== undefined &&
          methodName !== null &&
          methodName.text.toLowerCase() === "__construct"
        )
          for (const parameter of child.childForFieldName("parameters")
            ?.namedChildren ?? [])
            if (parameter.type === "property_promotion_parameter")
              this.add(parameter, parameter, "property", namespace, owner);
      } else if (
        child.type === "property_declaration" ||
        child.type === "const_declaration"
      ) {
        for (const element of child.namedChildren)
          if (
            element.type === "property_element" ||
            element.type === "const_element"
          )
            this.add(element, child, "property", namespace, owner);
      } else if (child.type === "enum_case")
        this.add(child, child, "property", namespace, owner);
      else if (child.type === "use_declaration")
        this.problem(
          child,
          "trait-composition",
          "Trait use and adaptation can add, rename, or hide members; trait composition is not implemented.",
        );
      else if (!IGNORED.has(child.type)) {
        if (owner !== undefined)
          this.problem(
            child,
            "member-form",
            `PHP member '${child.type}' is not classified.`,
          );
        for (const declaration of child.descendantsOfType([
          ...TYPES,
          "function_definition",
        ]))
          this.problem(
            declaration,
            "conditional-declaration",
            "A declaration inside executable control flow has runtime-dependent availability.",
          );
      }
    }
  }

  /** Creates one independently fingerprinted declaration and attaches adjacent PHPDoc. */
  private add(
    item: Node,
    carrier: Node,
    symbol: EvidenceProgrammingSymbol,
    namespace: string[],
    owner: IPhpDeclaration | undefined,
  ): IPhpDeclaration | undefined {
    const nameNode =
      item.childForFieldName("name") ??
      (item.type === "const_element" ? item.namedChildren[0] : null);
    const name =
      nameNode === null || nameNode === undefined
        ? undefined
        : nameNode.text.replace(/^&\s*/u, "");
    if (name === undefined || name.length === 0) {
      this.problem(
        item,
        "declaration-name",
        "A PHP declaration has no static source name.",
      );
      return undefined;
    }
    const previous = carrier.previousNamedSibling;
    const doc =
      previous?.type === "comment" &&
      /^\s*$/u.test(
        this.source.content.slice(previous.endIndex, carrier.startIndex),
      )
        ? this.documentation.get(previous.startIndex)
        : undefined;
    const visibility = carrier.namedChildren.filter(
      (child) =>
        child.type === "visibility_modifier" && !child.text.includes("("),
    );
    const visible =
      (owner?.public ?? true) &&
      !visibility.some(
        (child) => child.text === "private" || child.text === "protected",
      );
    const identity = [...(owner?.identity ?? namespace), name];
    const siteId = `php:${this.source.id}:site:${carrier.startIndex}`;
    const declaration: IPhpDeclaration = {
      id: `php:${this.source.id}:declaration:${item.startIndex}:${name}`,
      name,
      symbol,
      form: item.type,
      identity,
      address: identity,
      public: visible,
      site: {
        id: siteId,
        file: this.source.physicalPath,
        range: this.text.range(
          doc?.range?.start?.offset ?? carrier.startIndex,
          carrier.endIndex,
        ),
        content:
          item.id === carrier.id
            ? [this.session.range(carrier)]
            : [
                this.text.range(
                  carrier.startIndex,
                  carrier.namedChildren.find(
                    (child) => child.type === item.type,
                  )?.startIndex ?? item.startIndex,
                ),
                this.session.range(item),
                ...carrier.namedChildren
                  .filter((child) => child.type === "property_hook_list")
                  .map((child) => this.session.range(child)),
              ],
      },
      ...(owner === undefined ? {} : { ownerDeclarationId: owner.id }),
    };
    this.declarations.push(declaration);
    if (doc !== undefined)
      doc.attachments.push({ declarationId: declaration.id, siteId });
    return declaration;
  }

  /** Reports dynamic global declarations even when nested inside a function body. */
  private dynamicSurface(root: Node): void {
    const dynamicNames = new Set([
      "eval",
      "define",
      "class_alias",
      "spl_autoload_register",
    ]);
    for (const imported of root.descendantsOfType(
      "namespace_use_declaration",
    )) {
      if (imported.childForFieldName("type")?.text !== "function") continue;
      for (const clause of imported.descendantsOfType("namespace_use_clause")) {
        const importedName = clause.namedChildren[0];
        const target =
          importedName === undefined
            ? undefined
            : importedName.text.replace(/^\\/u, "").toLowerCase();
        const alias = clause.childForFieldName("alias");
        if (target !== undefined && dynamicNames.has(target) && alias !== null)
          dynamicNames.add(alias.text.toLowerCase());
      }
    }
    for (const node of root.descendantsOfType([
      "include_expression",
      "include_once_expression",
      "require_expression",
      "require_once_expression",
    ]))
      this.problem(
        node,
        "runtime-loader",
        "Runtime includes require execution and may change declarations; select explicit source files and remove runtime discovery from this population.",
      );
    for (const node of root.descendantsOfType("function_call_expression")) {
      const target = node.childForFieldName("function");
      if (
        target !== null &&
        dynamicNames.has(target.text.replace(/^\\/u, "").toLowerCase())
      )
        this.problem(
          node,
          "dynamic-declaration",
          `PHP ${target.text} can generate declarations or change their availability.`,
        );
    }
    for (const node of root.descendantsOfType([
      ...TYPES,
      "function_definition",
    ]))
      if (
        node.parent !== null &&
        !["program", "compound_statement"].includes(node.parent.type)
      )
        this.problem(
          node,
          "conditional-declaration",
          "Nested declarations can change the global public surface at runtime.",
        );
      else if (
        node.parent?.type === "compound_statement" &&
        node.parent.parent?.type !== "namespace_definition"
      )
        this.problem(
          node,
          "conditional-declaration",
          "Declarations in executable blocks have runtime-dependent availability.",
        );
  }

  /** Marks unsupported surface-changing syntax as incomplete at its original range. */
  private problem(node: Node, code: string, message: string): void {
    if (
      this.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === `php-${code}` &&
          diagnostic.location?.range?.start?.offset === node.startIndex,
      )
    )
      return;
    this.diagnostics.push({
      code: `php-${code}`,
      severity: "error",
      message,
      repair:
        "Use explicit supported declarations or add PHP adapter support before evaluating coverage.",
      location: {
        file: this.source.physicalPath,
        range: this.session.range(node),
      },
    });
  }
}

/** Nominal declarations whose members have an explicit lexical owner. */
const TYPES = new Set([
  "class_declaration",
  "interface_declaration",
  "trait_declaration",
  "enum_declaration",
]);

/** Syntax that introduces no independently declared public symbol. */
const IGNORED = new Set([
  "php_tag",
  "php_end_tag",
  "text",
  "text_interpolation",
  "comment",
  "namespace_use_declaration",
  "empty_statement",
]);
