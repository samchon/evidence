import type { Node as EvidNode } from "web-tree-sitter";

import { EvidDocumentation } from "../../parsers/EvidDocumentation";
import type { EvidParseSession } from "../../parsers/EvidParseSession";
import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { IEvidUnitSite } from "../../structures/IEvidUnitSite";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";
import type { EvidCDeclarationForm } from "./EvidCDeclarationForm";
import { EvidCSyntax } from "./EvidCSyntax";
import type { IEvidCDeclaration } from "./IEvidCDeclaration";
import type { IEvidCDeclarationAddress } from "./IEvidCDeclarationAddress";
import type { IEvidCDeclaratorShape } from "./IEvidCDeclaratorShape";
import type { IEvidCDocumentation } from "./IEvidCDocumentation";
import type { IEvidCFileAnalysis } from "./IEvidCFileAnalysis";
import type { IEvidCTypeContext } from "./IEvidCTypeContext";
import { EvidSourceText } from "../../internal/EvidSourceText";

/**
 * Extracts explicit C declarations and Doxygen without preprocessing source.
 *
 * It records physical declaration and attachment facts for `EvidCAdapter` to
 * reconcile; it never infers declarations from included or expanded source.
 */
export class EvidCFileScanner {
  private readonly declarations: IEvidCDeclaration[] = [];
  private readonly documentation = new Map<string, IEvidCDocumentation>();
  private readonly carrierDocumentation = new Map<
    string,
    IEvidCDocumentation
  >();
  private readonly diagnostics: IEvidDiagnostic[] = [];
  private readonly reported = new Set<string>();
  private readonly tags = new Map<string, IEvidCTypeContext>();
  private readonly text: EvidSourceText;
  private complete = true;

  /**
   * Creates one scanner bound to a live C parse session and source snapshot.
   *
   * Documentation is collected before declaration walking so adjacency can be
   * decided against the original source positions.
   */
  public constructor(
    private readonly session: EvidParseSession,
    private readonly source: IEvidSourceFile,
  ) {
    this.text = new EvidSourceText(source.content);
    this.collectDocumentation();
  }

  /**
   * Scans supported top-level C constructs into node-free file analysis.
   *
   * Unsupported public-surface syntax adds diagnostics and makes the returned
   * analysis incomplete instead of silently omitting its declarations.
   */
  public scan(): IEvidCFileAnalysis {
    const items = this.session.root.namedChildren;
    const population = items.filter((item) => !this.inertTopLevel(item));
    const guarded =
      population.length === 1 && population[0] !== undefined
        ? EvidCSyntax.guardedDeclarations(population[0])
        : undefined;
    for (const item of guarded ?? items) this.scanTopLevel(item);
    return {
      source: this.source,
      declarations: this.declarations,
      documentation: Array.from(this.documentation.values()),
      diagnostics: this.diagnostics,
      complete: this.complete,
    };
  }

  private scanTopLevel(item: EvidNode): void {
    switch (item.type) {
      case "comment":
      case "preproc_include":
      case "preproc_def":
      case "preproc_function_def":
      case "_static_assert_declaration":
      case "static_assert_declaration":
        return;
      case "function_definition":
        this.scanFunctionDefinition(item);
        return;
      case "declaration":
        this.scanExternalDeclaration(item);
        return;
      case "type_definition":
        this.scanTypeDefinition(item);
        return;
      case "struct_specifier":
      case "union_specifier":
      case "enum_specifier":
        this.scanTag(item, [], item, this.documentationFor(item));
        return;
      case "preproc_if":
      case "preproc_ifdef":
        this.conditional(item);
        return;
      case "preproc_call":
        if (!EvidCSyntax.isInertDirective(item))
          this.preprocessorDirective(item);
        return;
      case "expression_statement":
        if (!EvidCSyntax.isStaticAssertion(item)) this.macroDeclaration(item);
        return;
      default:
        this.problem(
          "c-declaration-form",
          `C translation-unit form '${item.type}' is not classified by this adapter.`,
          "Add an explicit source-declaration rule before evaluating this file.",
          item,
        );
    }
  }

  private inertTopLevel(node: EvidNode): boolean {
    return (
      node.type === "comment" ||
      node.type === "preproc_include" ||
      node.type === "preproc_def" ||
      node.type === "preproc_function_def" ||
      node.type === "_static_assert_declaration" ||
      node.type === "static_assert_declaration" ||
      EvidCSyntax.isStaticAssertion(node) ||
      EvidCSyntax.isInertDirective(node)
    );
  }

  private scanFunctionDefinition(item: EvidNode): void {
    if (EvidCSyntax.storage(item, "static")) return;
    const declarator = item.childForFieldName("declarator");
    if (declarator === null) {
      this.problem(
        "c-function-declarator",
        "A C function definition has no statically readable function declarator.",
        "Use an ordinary named function definition supported by the pinned grammar.",
        item,
      );
      return;
    }
    const conditional = this.firstConditional(declarator);
    if (conditional !== undefined) this.conditional(conditional);
    const shape = EvidCSyntax.declarator(declarator);
    if (shape === undefined || shape.kind !== "function") {
      this.problem(
        "c-function-declarator",
        "A C function definition has no statically readable function declarator.",
        "Use an ordinary named function definition supported by the pinned grammar.",
        item,
      );
      return;
    }
    this.addDeclaration(
      declarator,
      item,
      this.documentationFor(item),
      [this.session.range(item)],
      shape.name,
      "function",
      "function",
      [shape.name],
      [this.canonicalAddress([shape.name])],
      true,
    );
  }

  private scanExternalDeclaration(item: EvidNode): void {
    const conditional = this.firstConditional(item);
    if (conditional !== undefined) this.conditional(conditional);
    const specifier = item.childForFieldName("type");
    if (EvidCSyntax.tagForm(specifier) !== null && specifier !== null)
      this.scanTag(specifier, [], item, this.documentationFor(item));
    if (EvidCSyntax.storage(item, "static")) return;

    const documentation = this.documentationFor(item);
    const declarators = EvidCSyntax.declarators(item);
    const first = declarators[0];
    const header =
      first === undefined
        ? this.session.range(item)
        : this.text.range(item.startIndex, first.startIndex);
    for (const declarator of declarators) {
      const shape = EvidCSyntax.declarator(declarator);
      if (shape === undefined) {
        this.unreadableDeclarator(declarator);
        continue;
      }
      const functionDeclaration = shape.kind === "function";
      this.addRootDeclaration(
        shape,
        item,
        documentation,
        [header, this.session.range(declarator)],
        functionDeclaration ? "function" : "property",
        functionDeclaration ? "function" : "object",
        functionDeclaration
          ? false
          : declarator.type === "init_declarator" ||
              !EvidCSyntax.storage(item, "extern"),
      );
    }
  }

  private scanTypeDefinition(item: EvidNode): void {
    const conditional = this.firstConditional(item);
    if (conditional !== undefined) this.conditional(conditional);
    const documentation = this.documentationFor(item);
    const declarators = EvidCSyntax.declarators(item);
    const first = declarators[0];
    const header =
      first === undefined
        ? this.session.range(item)
        : this.text.range(item.startIndex, first.startIndex);
    const shapes = declarators.flatMap((declarator) => {
      const shape = EvidCSyntax.declarator(declarator);
      if (shape === undefined) {
        this.unreadableDeclarator(declarator);
        return [];
      }
      return [shape];
    });
    const specifier = item.childForFieldName("type");
    const tag = EvidCSyntax.tagForm(specifier);
    const directAliases = Array.from(
      new Set(
        shapes.flatMap((shape) =>
          shape.kind === "direct" ? [shape.name] : [],
        ),
      ),
    ).sort(compare);
    const owner =
      tag === null || specifier === null
        ? undefined
        : this.scanTag(specifier, directAliases, item, documentation);

    for (const shape of shapes) {
      if (owner !== undefined && shape.kind === "direct") continue;
      this.addRootDeclaration(
        shape,
        item,
        documentation,
        [header, this.session.range(shape.node)],
        "type",
        "typedef",
        true,
      );
    }
  }

  private scanTag(
    specifier: EvidNode,
    directAliases: string[],
    siteNode: EvidNode,
    documentation: IEvidCDocumentation[],
  ): IEvidCTypeContext | undefined {
    const form = EvidCSyntax.tagForm(specifier);
    if (form === null) return undefined;
    const tagName = EvidCSyntax.name(specifier.childForFieldName("name"));
    const body = specifier.childForFieldName("body");
    const aliases = Array.from(new Set(directAliases)).sort(compare);
    const stored =
      tagName === undefined ? undefined : this.tags.get(`${form}:${tagName}`);
    if (stored !== undefined && body === null && aliases.length === 0)
      return stored;
    if (tagName === undefined && aliases.length === 0) return undefined;

    const identityName =
      tagName === undefined ? aliases[0] : `${form} ${tagName}`;
    if (identityName === undefined) return undefined;
    const addresses = this.tagAddresses(form, tagName, aliases);
    const declaration = this.addDeclaration(
      specifier,
      siteNode,
      documentation,
      [this.session.range(specifier)],
      tagName ?? identityName,
      "type",
      form,
      [identityName],
      addresses,
      body !== null,
      undefined,
      tagName,
    );
    const context: IEvidCTypeContext = {
      declarationId: declaration.id,
      identity: declaration.identity,
    };
    if (tagName !== undefined) this.tags.set(`${form}:${tagName}`, context);
    if (body === null) return context;
    if (form === "enum") this.scanEnumerators(body, context);
    else this.scanFields(body, context);
    return context;
  }

  private scanFields(body: EvidNode, owner: IEvidCTypeContext): void {
    for (const field of body.namedChildren)
      switch (field.type) {
        case "comment":
        case "_static_assert_declaration":
        case "static_assert_declaration":
          break;
        case "field_declaration":
          this.scanField(field, owner);
          break;
        case "preproc_if":
        case "preproc_ifdef":
          this.conditional(field);
          break;
        case "preproc_call":
          if (!EvidCSyntax.isInertDirective(field))
            this.preprocessorDirective(field);
          break;
        default:
          this.problem(
            "c-field-form",
            `C aggregate member form '${field.type}' is not classified by this adapter.`,
            "Add an explicit aggregate-member rule before evaluating this type.",
            field,
          );
      }
  }

  private scanField(item: EvidNode, owner: IEvidCTypeContext): void {
    const documentation = this.documentationFor(item);
    const specifier = item.childForFieldName("type");
    const tag = EvidCSyntax.tagForm(specifier);
    const declarators = EvidCSyntax.declarators(item);
    if (tag !== null && specifier !== null && declarators.length === 0) {
      const name = EvidCSyntax.name(specifier.childForFieldName("name"));
      if (name === undefined) {
        const body = specifier.childForFieldName("body");
        if (body !== null) {
          if (tag === "enum") this.scanEnumerators(body, owner);
          else this.scanFields(body, owner);
        }
      } else this.scanTag(specifier, [], item, documentation);
      return;
    }
    if (tag !== null && specifier !== null)
      this.scanTag(specifier, [], item, documentation);

    const first = declarators[0];
    const header =
      first === undefined
        ? this.session.range(item)
        : this.text.range(item.startIndex, first.startIndex);
    for (const declarator of declarators) {
      const shape = EvidCSyntax.declarator(declarator);
      if (shape === undefined) {
        this.unreadableDeclarator(declarator);
        continue;
      }
      this.addDeclaration(
        declarator,
        item,
        documentation,
        [header, this.session.range(declarator)],
        shape.name,
        "property",
        "field",
        [...owner.identity, shape.name],
        [],
        true,
        owner.declarationId,
      );
    }
  }

  private scanEnumerators(body: EvidNode, owner: IEvidCTypeContext): void {
    for (const item of body.namedChildren)
      switch (item.type) {
        case "comment":
          break;
        case "enumerator": {
          const name = EvidCSyntax.name(item.childForFieldName("name"));
          if (name === undefined) {
            this.unreadableDeclarator(item);
            break;
          }
          this.addDeclaration(
            item,
            item,
            this.documentationFor(item),
            [this.session.range(item)],
            name,
            "property",
            "enumerator",
            [...owner.identity, name],
            [],
            true,
            owner.declarationId,
          );
          break;
        }
        case "preproc_if":
        case "preproc_ifdef":
          this.conditional(item);
          break;
        case "preproc_call":
          if (!EvidCSyntax.isInertDirective(item))
            this.preprocessorDirective(item);
          break;
        default:
          this.problem(
            "c-enumerator-form",
            `C enum member form '${item.type}' is not classified by this adapter.`,
            "Add an explicit enumerator rule before evaluating this enum.",
            item,
          );
      }
  }

  private addRootDeclaration(
    shape: IEvidCDeclaratorShape,
    siteNode: EvidNode,
    documentation: IEvidCDocumentation[],
    content: IEvidSourceRange[],
    symbol: EvidProgrammingSymbol,
    form: Extract<EvidCDeclarationForm, "typedef" | "function" | "object">,
    definition: boolean,
  ): IEvidCDeclaration {
    return this.addDeclaration(
      shape.node,
      siteNode,
      documentation,
      content,
      shape.name,
      symbol,
      form,
      [shape.name],
      [this.canonicalAddress([shape.name])],
      definition,
    );
  }

  private addDeclaration(
    item: EvidNode,
    siteNode: EvidNode,
    documentation: IEvidCDocumentation[],
    content: IEvidSourceRange[],
    name: string,
    symbol: EvidProgrammingSymbol,
    form: EvidCDeclarationForm,
    identity: string[],
    addresses: IEvidCDeclarationAddress[],
    definition: boolean,
    ownerDeclarationId?: string,
    tagName?: string,
  ): IEvidCDeclaration {
    const start = Math.min(
      siteNode.startIndex,
      ...documentation.map((entry) => entry.range.start.offset),
    );
    const end = Math.max(
      siteNode.endIndex,
      ...documentation.map((entry) => entry.range.end.offset),
    );
    const site: IEvidUnitSite = {
      id: this.siteId(siteNode),
      file: this.source.physicalPath,
      range: this.text.range(start, end),
      content,
    };
    const declaration: IEvidCDeclaration = {
      id: `c:${this.source.id}:declaration:${form}:${item.startIndex}:${name}`,
      name,
      symbol,
      form,
      identity,
      addresses,
      site,
      definition,
      ...(ownerDeclarationId === undefined ? {} : { ownerDeclarationId }),
      ...(tagName === undefined ? {} : { tagName }),
    };
    this.declarations.push(declaration);
    for (const entry of documentation)
      this.attach(entry, declaration.id, site.id);
    return declaration;
  }

  private tagAddresses(
    form: Extract<EvidCDeclarationForm, "struct" | "union" | "enum">,
    tagName: string | undefined,
    aliases: string[],
  ): IEvidCDeclarationAddress[] {
    const addresses = aliases.map((alias) => this.canonicalAddress([alias]));
    if (tagName === undefined) return addresses;
    const exact = `${form} ${tagName}`;
    return [
      this.canonicalAddress([exact]),
      {
        segments: [tagName],
        canonical: false,
        aliasPrefixes: [[tagName]],
      },
      ...addresses,
    ];
  }

  private canonicalAddress(segments: string[]): IEvidCDeclarationAddress {
    return { segments, canonical: true, aliasPrefixes: [] };
  }

  private documentationFor(node: EvidNode): IEvidCDocumentation[] {
    const output: IEvidCDocumentation[] = [];
    const previous = node.previousNamedSibling;
    if (previous !== null && EvidCSyntax.isDoxygen(previous)) {
      const documentation = this.carrierDocumentation.get(
        this.nodeKey(previous),
      );
      if (
        documentation !== undefined &&
        !EvidCSyntax.isTrailingDoxygen(previous) &&
        this.adjacent(documentation.range.end.offset, node.startIndex, true)
      )
        output.push(documentation);
    }
    const next = node.nextNamedSibling;
    if (next !== null && EvidCSyntax.isTrailingDoxygen(next)) {
      const documentation = this.carrierDocumentation.get(this.nodeKey(next));
      if (
        documentation !== undefined &&
        this.trailingAdjacent(
          node,
          documentation.range.start.offset,
          next.startPosition.row,
        )
      )
        output.push(documentation);
    }
    return output;
  }

  private adjacent(start: number, end: number, allowNewline: boolean): boolean {
    const gap = this.source.content.slice(start, end);
    return (
      /^\s*$/u.test(gap) &&
      !/\r?\n[ \t]*\r?\n/u.test(gap) &&
      (allowNewline || !/[\r\n]/u.test(gap))
    );
  }

  private trailingAdjacent(
    node: EvidNode,
    end: number,
    commentRow: number,
  ): boolean {
    if (node.endPosition.row !== commentRow) return false;
    const gap = this.source.content.slice(node.endIndex, end);
    if (node.type === "enumerator") return /^[ \t]*,[ \t]*$/u.test(gap);
    if (
      node.type === "struct_specifier" ||
      node.type === "union_specifier" ||
      node.type === "enum_specifier"
    )
      return /^[ \t]*;[ \t]*$/u.test(gap);
    return /^[ \t]*$/u.test(gap);
  }

  private collectDocumentation(): void {
    const comments = this.session.root
      .descendantsOfType("comment")
      .sort((left, right) => left.startIndex - right.startIndex);
    const consumed = new Set<string>();
    for (const first of comments) {
      if (consumed.has(this.nodeKey(first))) continue;
      const sequence: EvidNode[] = [first];
      consumed.add(this.nodeKey(first));
      let last = first;
      if (
        first.text.startsWith("//") &&
        !EvidCSyntax.isTrailingDoxygen(first)
      ) {
        let next = last.nextNamedSibling;
        while (
          next !== null &&
          next.type === "comment" &&
          this.lineFamily(next) === this.lineFamily(first) &&
          next.startPosition.column === first.startPosition.column &&
          this.adjacent(last.endIndex, next.startIndex, true)
        ) {
          sequence.push(next);
          consumed.add(this.nodeKey(next));
          last = next;
          next = last.nextNamedSibling;
        }
      }
      const range = this.text.range(first.startIndex, last.endIndex);
      const syntax = EvidCSyntax.comment(first);
      const supported = EvidCSyntax.isDoxygen(first);
      const raw = EvidDocumentation.read(
        this.source.content,
        "c-probe",
        range,
        syntax,
      ).text;
      if (!supported && !this.annotation(raw)) continue;
      const documentation = this.ensureDocumentation(range, syntax);
      for (const comment of sequence)
        this.carrierDocumentation.set(this.nodeKey(comment), documentation);
    }

    for (const literal of this.session.root.descendantsOfType(
      "string_literal",
    )) {
      const syntax = EvidCSyntax.string(literal);
      if (syntax === undefined) continue;
      const range = this.session.range(literal);
      const raw = EvidDocumentation.read(
        this.source.content,
        "c-probe",
        range,
        syntax,
      ).text;
      if (this.annotation(raw)) this.ensureDocumentation(range, syntax);
    }
  }

  private lineFamily(node: EvidNode): string {
    if (node.text.startsWith("///<")) return "///<";
    if (node.text.startsWith("//!<")) return "//!<";
    if (node.text.startsWith("///")) return "///";
    if (node.text.startsWith("//!")) return "//!";
    return "//";
  }

  private attach(
    documentation: IEvidCDocumentation,
    declarationId: string,
    siteId: string,
  ): void {
    if (
      !documentation.attachments.some(
        (attachment) =>
          attachment.declarationId === declarationId &&
          attachment.siteId === siteId,
      )
    )
      documentation.attachments.push({ declarationId, siteId });
  }

  private ensureDocumentation(
    range: IEvidSourceRange,
    syntax: IEvidCommentSyntax,
  ): IEvidCDocumentation {
    const key = `${range.start.offset}:${range.end.offset}`;
    let documentation = this.documentation.get(key);
    if (documentation === undefined) {
      documentation = {
        id: `c:${this.source.id}:documentation:${key}`,
        range,
        syntax,
        attachments: [],
      };
      this.documentation.set(key, documentation);
    }
    return documentation;
  }

  private unreadableDeclarator(node: EvidNode): void {
    this.problem(
      "c-declarator-name",
      "A selected C declarator has no statically readable identifier.",
      "Use one named declarator supported by the pinned grammar.",
      node,
    );
  }

  private firstConditional(node: EvidNode): EvidNode | undefined {
    for (const type of ["preproc_if", "preproc_ifdef"]) {
      const conditional = node.descendantsOfType(type)[0];
      if (conditional !== undefined) return conditional;
    }
    return undefined;
  }

  private conditional(node: EvidNode): void {
    this.problem(
      "c-preprocessor-conditional",
      "Conditional preprocessing can change the selected C declaration population.",
      "Select generated preprocessed source or remove declaration-position conditional branches.",
      node,
    );
  }

  private macroDeclaration(node: EvidNode): void {
    this.problem(
      "c-macro-declaration",
      "A declaration-position macro invocation can generate an unknown C surface.",
      "Select the generated declaration source or replace the invocation with explicit declarations.",
      node,
    );
  }

  private preprocessorDirective(node: EvidNode): void {
    this.problem(
      "c-preprocessor-directive",
      "A selected C preprocessor directive can change declaration semantics.",
      "Select generated source or add an explicit rule for this directive before evaluating coverage.",
      node,
    );
  }

  private annotation(raw: string): boolean {
    return /(?:^|[\r\n])[ \t]*@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link|internal|hidden|ignore)\b/u.test(
      raw,
    );
  }

  private nodeKey(node: EvidNode): string {
    return `${node.startIndex}:${node.endIndex}`;
  }

  private siteId(node: EvidNode): string {
    return `c:${this.source.id}:site:${this.nodeKey(node)}`;
  }

  private problem(
    code: string,
    message: string,
    repair: string,
    node: EvidNode,
  ): void {
    const key = `${code}:${node.startIndex}:${node.endIndex}`;
    if (this.reported.has(key)) return;
    this.reported.add(key);
    this.complete = false;
    this.diagnostics.push({
      code,
      severity: "error",
      message,
      repair,
      location: {
        file: this.source.physicalPath,
        range: this.session.range(node),
      },
    });
  }
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
