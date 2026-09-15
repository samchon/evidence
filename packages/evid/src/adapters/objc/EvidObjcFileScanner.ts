import type { Node as EvidNode } from "web-tree-sitter";

import { EvidSourceText } from "../../internal/EvidSourceText";
import type { EvidParseSession } from "../../parsers/EvidParseSession";
import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";
import { EvidCSyntax } from "../c/EvidCSyntax";
import type { IEvidObjcDeclaration } from "./IEvidObjcDeclaration";
import type { IEvidObjcDocumentation } from "./IEvidObjcDocumentation";
import type { IEvidObjcFileAnalysis } from "./IEvidObjcFileAnalysis";
import type { EvidObjcDeclarationForm } from "./EvidObjcDeclarationForm";

/**
 * Extracts explicit interfaces before reconciling implementations across
 * selected files.
 *
 * Headers, implementations, categories, and extensions retain independent sites
 * here because the adapter must prove their common semantic identity later.
 */
export class EvidObjcFileScanner {
  /**
   * Original UTF-16 source coordinates.
   *
   * All declaration and comment ranges use this mapper after parser release.
   */
  private readonly text: EvidSourceText;

  /**
   * Serializable declaration sites, including unpublished implementation sites.
   *
   * Reconciliation later determines which records contribute public units.
   */
  private readonly declarations: IEvidObjcDeclaration[] = [];

  /**
   * Documentation carriers indexed by their original start offset.
   *
   * Offset lookup supports adjacency checks without changing source
   * coordinates.
   */
  private readonly documentation = new Map<number, IEvidObjcDocumentation>();

  /**
   * Failures that prevent a complete public denominator.
   *
   * The final adapter propagates these diagnostics into an incomplete
   * inventory.
   */
  private readonly diagnostics: IEvidDiagnostic[] = [];

  /**
   * Borrows a parser session only for the duration of extraction.
   *
   * The source text mapper is created at this boundary so all later sites use
   * original UTF-16 offsets, independent of the parser session's lifetime.
   */
  public constructor(
    private readonly session: EvidParseSession,
    private readonly source: IEvidSourceFile,
  ) {
    this.text = new EvidSourceText(source.content);
  }

  /**
   * Returns node-free declarations and documentation.
   *
   * Comment classification precedes top-level traversal, allowing Doxygen to
   * attach only to the adjacent declaration before reconciliation merges
   * sites.
   */
  public scan(): IEvidObjcFileAnalysis {
    this.comments();
    const items = this.session.root.namedChildren;
    const population = items.filter(
      (item) =>
        item.type !== "comment" &&
        item.type !== "preproc_include" &&
        !EvidCSyntax.isInertDirective(item),
    );
    const guard = population.length === 1 ? population[0] : undefined;
    const guarded =
      guard === undefined ? undefined : EvidCSyntax.guardedDeclarations(guard);
    for (const item of items)
      if (guarded !== undefined && item.startIndex === guard?.startIndex)
        for (const child of guarded) this.topLevel(child);
      else this.topLevel(item);
    return {
      source: this.source,
      declarations: this.declarations,
      documentation: [...new Set(this.documentation.values())],
      diagnostics: this.diagnostics,
      complete: this.diagnostics.length === 0,
    };
  }

  /**
   * Classifies every top-level form without executing preprocessing.
   *
   * Unsupported source surfaces become diagnostics before they can reduce
   * coverage.
   */
  private topLevel(item: EvidNode): void {
    switch (item.type) {
      case "class_interface":
      case "class_implementation":
      case "protocol_declaration":
        this.typeDeclaration(item);
        return;
      case "function_definition":
      case "declaration":
        this.functionDeclaration(item);
        return;
      case "comment":
      case "class_declaration":
      case "protocol_forward_declaration":
      case "module_import":
        return;
      case "preproc_include": {
        const path = item.childForFieldName("path");
        if (
          path?.type !== "string_literal" &&
          path?.type !== "system_lib_string"
        )
          this.problem(
            item,
            "include",
            "Macro-dependent include paths cannot establish a declared source boundary.",
          );
        return;
      }
      default: {
        if (EvidCSyntax.isInertDirective(item)) return;
        this.problem(
          item,
          "surface",
          `Objective-C source form '${item.type}' can change the declared surface and is not supported.`,
        );
      }
    }
  }

  /**
   * Keeps protocols and named categories in distinct nominal namespaces.
   *
   * Their literal owner paths must not collide with ordinary interface
   * declarations.
   */
  private typeDeclaration(item: EvidNode): void {
    const nameNode = item.namedChildren.find(
      (child) => child.type === "identifier",
    );
    const name = EvidCSyntax.name(nameNode ?? null);
    if (name === undefined) {
      this.problem(item, "name", "The nominal declaration has no static name.");
      return;
    }
    const category = EvidCSyntax.name(item.childForFieldName("category"));
    const extension =
      item.type === "class_interface" &&
      category === undefined &&
      item.children.some((child) => child.type === "(");
    const protocol = item.type === "protocol_declaration";
    const implementation = item.type === "class_implementation";
    const nominal = protocol
      ? `protocol(${name})`
      : category === undefined
        ? name
        : `${name}(${category})`;
    const form: EvidObjcDeclarationForm = implementation
      ? "implementation"
      : extension
        ? "extension"
        : protocol
          ? "protocol"
          : category === undefined
            ? "interface"
            : "category";
    const owner = this.add(
      item,
      item,
      nominal,
      "type",
      form,
      [nominal],
      !implementation && !extension,
    );
    for (const member of item.namedChildren) this.member(member, owner);
  }

  /**
   * Traverses grammar wrappers while retaining interface exposure rules.
   *
   * Nested members inherit the owning declaration's supported public boundary.
   */
  private member(item: EvidNode, owner: IEvidObjcDeclaration): void {
    switch (item.type) {
      case "identifier":
      case "comment":
      case "parameterized_arguments":
      case "generic_arguments":
      case "protocol_reference_list":
      case "attribute_specifier":
      case "attribute_declaration":
      case "availability_attribute_specifier":
      case "storage_class_specifier":
        return;
      case "implementation_definition":
      case "qualified_protocol_interface_declaration":
        for (const child of item.namedChildren) this.member(child, owner);
        return;
      case "method_declaration":
      case "method_definition": {
        this.signature(item);
        const selector = this.selector(item);
        if (selector === undefined) {
          this.problem(
            item,
            "selector",
            "The method selector cannot be represented without losing a selector component.",
          );
          return;
        }
        const site =
          item.parent?.type === "implementation_definition"
            ? item.parent
            : item;
        this.add(
          item,
          site,
          selector,
          "function",
          "method",
          [...owner.identity, selector],
          owner.public,
          owner,
        );
        return;
      }
      case "property_declaration": {
        const declaration = item.namedChildren.find(
          (child) => child.type === "struct_declaration",
        );
        const attributes = item.namedChildren.find(
          (child) => child.type === "property_attributes_declaration",
        );
        const classProperty =
          attributes !== undefined &&
          attributes.namedChildren.some((child) => child.text === "class");
        if (declaration === undefined)
          this.problem(
            item,
            "property",
            "The property declarator is not supported.",
          );
        else
          this.properties(
            declaration,
            item,
            owner,
            "property",
            owner.public,
            classProperty ? "class:" : "",
          );
        return;
      }
      case "instance_variables": {
        let visible = false;
        for (const wrapper of item.namedChildren) {
          if (wrapper.type === "comment") continue;
          const child = wrapper.namedChildren[0];
          if (child?.type === "visibility_specification")
            visible = child.text === "@public";
          else if (child?.type === "struct_declaration")
            this.properties(
              child,
              wrapper,
              owner,
              "ivar",
              visible && owner.public,
              "ivar:",
            );
          else
            this.problem(
              wrapper,
              "ivar",
              "The instance-variable form is not supported.",
            );
        }
        return;
      }
      case "property_implementation":
        // Retain explicit property implementation content without inventing accessors.
        this.propertyImplementation(item, owner);
        return;
      case "function_definition":
      case "declaration":
        this.functionDeclaration(item);
        return;
      default:
        this.problem(
          item,
          "surface",
          `Objective-C member form '${item.type}' is not supported.`,
        );
    }
  }

  /**
   * Associates synthesize/dynamic sites with independently declared properties.
   *
   * These implementation forms supplement a property identity without inventing
   * one.
   */
  private propertyImplementation(
    item: EvidNode,
    owner: IEvidObjcDeclaration,
  ): void {
    let next = true;
    const first = item.namedChildren.find(
      (child) => child.type === "identifier",
    );
    const suffix = item.children.findLast((child) => child.type === ";");
    const prefix = item.children.some((child) => child.type === "(class)")
      ? "class:"
      : "";
    for (const [index, child] of item.children.entries()) {
      if (child.type === ",") next = true;
      else if (child.type === "identifier" && next) {
        const name = `${prefix}${EvidCSyntax.name(child) ?? child.text}`;
        const site =
          item.parent?.type === "implementation_definition"
            ? item.parent
            : item;
        const declaration = this.add(
          child,
          site,
          name,
          "property",
          "property",
          [...owner.identity, name],
          false,
          owner,
        );
        const end = item.children
          .slice(index + 1)
          .find((node) => node.type === "," || node.type === ";");
        if (first !== undefined && suffix !== undefined && end !== undefined)
          declaration.site.content = [
            this.text.range(site.startIndex, first.startIndex),
            this.text.range(child.startIndex, end.startIndex),
            this.text.range(suffix.startIndex, site.endIndex),
          ];
        next = false;
      }
    }
  }

  /**
   * Builds exact class/instance selectors using only top-level selector
   * components.
   *
   * Prefixes and colons distinguish source-spelled class and instance methods.
   */
  private selector(item: EvidNode): string | undefined {
    const sign = item.children[0]?.type;
    if (sign !== "+" && sign !== "-") return undefined;
    let selector = "";
    let pending = "";
    let parameters = 0;
    for (const child of item.namedChildren) {
      if (child.type === "identifier") {
        if (pending !== "") return undefined;
        pending = EvidCSyntax.name(child) ?? child.text;
      } else if (child.type === "method_parameter") {
        if (!child.text.startsWith(":")) continue;
        selector += `${pending}:`;
        pending = "";
        ++parameters;
      } else if (child.type === "keyword_declarator") return undefined;
    }
    if (parameters === 0) selector = pending;
    else if (pending !== "") return undefined;
    return selector === "" ? undefined : `${sign}${selector}`;
  }

  /**
   * Projects property and ivar names without conflating their runtime storage.
   *
   * Each supported declaration retains its own selector category and source
   * site.
   */
  private properties(
    item: EvidNode,
    site: EvidNode,
    owner: IEvidObjcDeclaration,
    form: "property" | "ivar",
    visible: boolean,
    prefix: string,
  ): void {
    this.signature(item);
    const declarators = item.namedChildren.filter(
      (child) => child.type === "struct_declarator",
    );
    if (declarators.length === 0)
      this.problem(
        item,
        "property",
        "No statically named property declarator was found.",
      );
    for (const declarator of declarators) {
      const node = declarator.namedChildren[0];
      const shape =
        node === undefined ? undefined : EvidCSyntax.declarator(node);
      if (shape === undefined) {
        this.problem(
          declarator,
          "property",
          "A property or ivar has an unsupported declarator.",
        );
        continue;
      }
      const name = `${prefix}${shape.name}`;
      const declaration = this.add(
        declarator,
        site,
        name,
        "property",
        form,
        [...owner.identity, name],
        visible,
        owner,
      );
      declaration.site.content = this.declaratorContent(
        site,
        declarators,
        declarator,
      );
    }
  }

  /**
   * Includes external C function declarations and definitions; static functions
   * stay private.
   *
   * Linkage determines whether a C function can join the Objective-C public
   * surface.
   */
  private functionDeclaration(item: EvidNode): void {
    this.signature(item);
    const visible =
      !EvidCSyntax.storage(item, "static") &&
      !EvidCSyntax.storage(item, "FOUNDATION_STATIC_INLINE") &&
      !EvidCSyntax.storage(item, "NS_INLINE");
    const declarators = item.childrenForFieldName("declarator");
    for (const declarator of declarators) {
      const shape = EvidCSyntax.declarator(declarator);
      if (shape === undefined || shape.kind !== "function") {
        if (visible)
          this.problem(
            declarator,
            "surface",
            "External C data declarations are outside the supported Objective-C surface.",
          );
        continue;
      }
      const declaration = this.add(
        declarator,
        item,
        shape.name,
        "function",
        "function",
        [shape.name],
        visible,
      );
      if (declarators.length > 1)
        declaration.site.content = this.declaratorContent(
          item,
          declarators,
          declarator,
        );
    }
  }

  /**
   * Separates one declarator from its siblings while retaining shared type and
   * attribute text.
   *
   * Each declarator receives its own unit site despite a shared declaration
   * header.
   */
  private declaratorContent(
    site: EvidNode,
    declarators: EvidNode[],
    declaration: EvidNode,
  ): IEvidSourceRange[] {
    const first = declarators[0];
    const last = declarators.at(-1);
    if (first === undefined || last === undefined)
      return [this.session.range(site)];
    return [
      this.text.range(site.startIndex, first.startIndex),
      this.session.range(declaration),
      this.text.range(last.endIndex, site.endIndex),
    ];
  }

  /**
   * Rejects nested aggregate definitions that would otherwise hide public
   * fields behind a property or return type.
   *
   * The scanner preserves incomplete state rather than claiming unsupported
   * nested members.
   */
  private signature(item: EvidNode): void {
    if (item.type === "compound_statement") return;
    if (
      ["struct_specifier", "union_specifier", "enum_specifier"].includes(
        item.type,
      ) &&
      item.childForFieldName("body") !== null
    ) {
      this.problem(
        item,
        "surface",
        "Aggregate definitions in declaration signatures require C type and field extraction that this Objective-C adapter does not support.",
      );
      return;
    }
    for (const child of item.namedChildren) this.signature(child);
  }

  /**
   * Adds a physical declaration site and attaches only adjacent Doxygen
   * documentation.
   *
   * Whitespace-only separation is required so unrelated comments cannot claim a
   * host.
   */
  private add(
    item: EvidNode,
    siteNode: EvidNode,
    name: string,
    symbol: EvidProgrammingSymbol,
    form: EvidObjcDeclarationForm,
    identity: string[],
    visible: boolean,
    owner?: IEvidObjcDeclaration,
  ): IEvidObjcDeclaration {
    const previous = siteNode.previousNamedSibling;
    const documentation =
      previous !== null &&
      EvidCSyntax.isDoxygen(previous) &&
      !EvidCSyntax.isTrailingDoxygen(previous) &&
      /^\s*$/u.test(
        this.source.content.slice(previous.endIndex, siteNode.startIndex),
      )
        ? this.documentation.get(previous.startIndex)
        : undefined;
    const siteId = `objc:${this.source.id}:site:${siteNode.startIndex}:${siteNode.endIndex}`;
    const declaration: IEvidObjcDeclaration = {
      id: `objc:${this.source.id}:${form}:${item.startIndex}:${name}`,
      name,
      symbol,
      form,
      identity,
      address: identity,
      public: visible,
      merge:
        form === "implementation" ||
        form === "extension" ||
        (form !== "ivar" &&
          (owner?.form === "implementation" || owner?.form === "extension")),
      definition:
        form === "implementation" ||
        item.type === "method_definition" ||
        siteNode.type === "function_definition" ||
        (form === "property" && owner?.form === "implementation"),
      site: {
        id: siteId,
        file: this.source.physicalPath,
        range: this.text.range(
          documentation === undefined
            ? siteNode.startIndex
            : documentation.range.start.offset,
          siteNode.endIndex,
        ),
        content: [this.session.range(siteNode)],
      },
      ...(owner === undefined ? {} : { ownerDeclarationId: owner.id }),
    };
    this.declarations.push(declaration);
    if (documentation !== undefined)
      documentation.attachments.push({ declarationId: declaration.id, siteId });
    return declaration;
  }

  /**
   * Collects contiguous Doxygen lines and unsupported annotation-bearing
   * comments.
   *
   * Tagged ordinary comments are retained for diagnostics without becoming
   * declarations.
   */
  private comments(): void {
    for (const comment of this.session.root.descendantsOfType("comment")) {
      const syntax = EvidCSyntax.comment(comment);
      const previous = comment.previousNamedSibling;
      const prior =
        previous?.type === "comment"
          ? this.documentation.get(previous.startIndex)
          : undefined;
      if (
        syntax.opening.startsWith("//") &&
        prior !== undefined &&
        prior.syntax.opening === syntax.opening &&
        previous !== null &&
        /^\s*$/u.test(
          this.source.content.slice(previous.endIndex, comment.startIndex),
        ) &&
        comment.startPosition.row === previous.endPosition.row + 1
      ) {
        prior.range = this.text.range(
          prior.range.start.offset,
          comment.endIndex,
        );
        this.documentation.set(comment.startIndex, prior);
      } else
        this.documentation.set(comment.startIndex, {
          id: `objc:${this.source.id}:documentation:${comment.startIndex}`,
          range: this.session.range(comment),
          syntax,
          attachments: [],
        });
    }
  }

  /**
   * Marks unsupported syntax incomplete instead of dropping public obligations.
   *
   * The reported range identifies the source form that requires adapter
   * support.
   */
  private problem(item: EvidNode, code: string, message: string): void {
    this.diagnostics.push({
      code: `objc-${code}`,
      severity: "error",
      message,
      repair:
        "Use explicit supported declarations or implement this source form before evaluating coverage.",
      location: {
        file: this.source.physicalPath,
        range: this.session.range(item),
      },
    });
  }
}
