import type { Node } from "web-tree-sitter";

import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { CSharpDeclarationForm } from "./CSharpDeclarationForm";
import { CSharpSyntax } from "./CSharpSyntax";
import type { CSharpTypeKind } from "./CSharpTypeKind";
import type { ICSharpDeclaration } from "./ICSharpDeclaration";
import type { ICSharpDeclarationAddress } from "./ICSharpDeclarationAddress";
import type { ICSharpDocumentation } from "./ICSharpDocumentation";
import type { ICSharpFileAnalysis } from "./ICSharpFileAnalysis";
import type { ICSharpTypeContext } from "./ICSharpTypeContext";
import { SourceText } from "../../internal/SourceText";

/** Extracts C# namespaces, declarations, and XML documentation. */
export class CSharpFileScanner {
  private readonly declarations: ICSharpDeclaration[] = [];
  private readonly documentation = new Map<string, ICSharpDocumentation>();
  private readonly carrierDocumentation = new Map<
    string,
    ICSharpDocumentation
  >();
  private readonly diagnostics: IEvidenceDiagnostic[] = [];
  private readonly reported = new Set<string>();
  private readonly text: SourceText;
  private complete = true;

  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
  ) {
    this.text = new SourceText(source.content);
    this.collectDocumentation();
  }

  public scan(): ICSharpFileAnalysis {
    let namespacePath: string[] = [];
    let fileScoped = false;
    for (const item of this.session.root.namedChildren) {
      if (item.type === "file_scoped_namespace_declaration") {
        const path = CSharpSyntax.path(item.childForFieldName("name"));
        if (path === undefined)
          this.problem(
            "csharp-namespace-name",
            "A file-scoped C# namespace has no statically readable name.",
            "Use one identifier or dotted namespace name.",
            item,
          );
        else if (fileScoped)
          this.problem(
            "csharp-file-namespace",
            "A C# source file declares more than one file-scoped namespace.",
            "Keep one file-scoped namespace in the selected source file.",
            item,
          );
        else {
          namespacePath = path;
          fileScoped = true;
        }
        continue;
      }
      this.scanDeclaration(item, namespacePath, undefined);
    }
    return {
      source: this.source,
      declarations: this.declarations,
      documentation: Array.from(this.documentation.values()),
      diagnostics: this.diagnostics,
      complete: this.complete,
    };
  }

  private scanDeclaration(
    item: Node,
    namespacePath: string[],
    owner: ICSharpTypeContext | undefined,
  ): void {
    switch (item.type) {
      case "comment":
      case "using_directive":
      case "extern_alias_directive":
      case "global_attribute_list":
      case "global_statement":
      case "constructor_declaration":
      case "destructor_declaration":
        return;
      case "namespace_declaration":
        if (owner === undefined) this.scanNamespace(item, namespacePath);
        return;
      case "class_declaration":
        this.scanType(item, namespacePath, owner, "class", "class");
        return;
      case "struct_declaration":
        this.scanType(item, namespacePath, owner, "struct", "struct");
        return;
      case "interface_declaration":
        this.scanType(item, namespacePath, owner, "interface", "interface");
        return;
      case "record_declaration":
        this.scanType(
          item,
          namespacePath,
          owner,
          "record",
          CSharpSyntax.hasToken(item, "struct") ? "record-struct" : "record",
        );
        return;
      case "enum_declaration":
        this.scanType(item, namespacePath, owner, "enum", "enum");
        return;
      case "delegate_declaration":
        this.scanType(item, namespacePath, owner, "delegate", "delegate");
        return;
      case "field_declaration":
        if (owner !== undefined) this.scanField(item, owner, "field");
        return;
      case "event_field_declaration":
        if (owner !== undefined) this.scanField(item, owner, "event");
        return;
      case "event_declaration":
        if (owner !== undefined) this.scanNamedMember(item, owner, "event");
        return;
      case "property_declaration":
        if (owner !== undefined) this.scanNamedMember(item, owner, "property");
        return;
      case "method_declaration":
        if (owner !== undefined) this.scanNamedMember(item, owner, "method");
        return;
      case "indexer_declaration":
        if (owner !== undefined) this.scanIndexer(item, owner);
        return;
      case "operator_declaration":
        if (owner !== undefined) this.scanOperator(item, owner);
        return;
      case "conversion_operator_declaration":
        if (owner !== undefined) this.scanConversionOperator(item, owner);
        return;
      case "preproc_if":
        this.problem(
          "csharp-preprocessor-conditional",
          "Conditional compilation can change the selected C# declaration population.",
          "Select preprocessed generated source or remove declaration-position conditional branches.",
          item,
        );
        return;
      default:
        if (CSharpSyntax.hasModifier(item, "public"))
          this.problem(
            "csharp-public-form",
            `Public C# source form '${item.type}' is not classified by this adapter.`,
            "Add an explicit declaration-form rule before evaluating this public surface.",
            item,
          );
    }
  }

  private scanNamespace(item: Node, prefix: string[]): void {
    const name = CSharpSyntax.path(item.childForFieldName("name"));
    if (name === undefined) {
      this.problem(
        "csharp-namespace-name",
        "A C# namespace declaration has no statically readable name.",
        "Use one identifier or dotted namespace name.",
        item,
      );
      return;
    }
    const body = item.childForFieldName("body");
    if (body === null) return;
    const namespacePath = [...prefix, ...name];
    for (const child of body.namedChildren)
      this.scanDeclaration(child, namespacePath, undefined);
  }

  private scanType(
    item: Node,
    namespacePath: string[],
    owner: ICSharpTypeContext | undefined,
    kind: CSharpTypeKind,
    form: Extract<
      CSharpDeclarationForm,
      | "class"
      | "struct"
      | "interface"
      | "record"
      | "record-struct"
      | "enum"
      | "delegate"
    >,
  ): void {
    const name = CSharpSyntax.name(item.childForFieldName("name"));
    if (name === undefined) {
      this.problem(
        "csharp-type-name",
        `A C# ${form} declaration has no statically readable name.`,
        "Use one ordinary named declaration.",
        item,
      );
      return;
    }
    const arity = CSharpSyntax.typeParameterArity(item);
    const identityName = arity === 0 ? name : `${name}\`${arity}`;
    const identity = [
      ...(owner === undefined ? namespacePath : owner.identity),
      identityName,
    ];
    const addresses = this.typeAddresses(
      owner?.addresses ?? [
        { segments: namespacePath, canonical: true, aliasPrefixes: [] },
      ],
      name,
      identityName,
    );
    const declaration = this.addDeclaration(
      item,
      item,
      this.documentationFor(item),
      [this.session.range(item)],
      name,
      "type",
      form,
      identity,
      addresses,
      owner?.kind === "interface",
      false,
      owner?.declarationId,
    );
    const context: ICSharpTypeContext = {
      declarationId: declaration.id,
      identity,
      addresses,
      kind,
    };
    const body = item.childForFieldName("body");
    if (body === null) return;
    if (kind === "enum") {
      for (const member of body.namedChildren)
        if (member.type === "enum_member_declaration")
          this.scanEnumMember(member, context);
        else this.scanDeclaration(member, namespacePath, context);
      return;
    }
    for (const member of body.namedChildren)
      this.scanDeclaration(member, namespacePath, context);
  }

  private scanField(
    item: Node,
    owner: ICSharpTypeContext,
    form: "field" | "event",
  ): void {
    const variable = item.namedChildren.find(
      (child) => child.type === "variable_declaration",
    );
    const declarators =
      variable === undefined
        ? []
        : variable.namedChildren.filter(
            (child) => child.type === "variable_declarator",
          );
    const first = declarators[0];
    if (first === undefined) return;
    const header = this.text.range(item.startIndex, first.startIndex);
    const documentation = this.documentationFor(item);
    const implicitPublic = owner.kind === "interface";
    for (const declarator of declarators) {
      const name = CSharpSyntax.name(declarator.childForFieldName("name"));
      if (name === undefined) continue;
      this.addDeclaration(
        declarator,
        item,
        documentation,
        [header, this.session.range(declarator)],
        name,
        "property",
        form,
        [...owner.identity, name],
        this.memberAddresses(owner, name),
        implicitPublic,
        false,
        owner.declarationId,
      );
    }
  }

  private scanNamedMember(
    item: Node,
    owner: ICSharpTypeContext,
    form: "method" | "property" | "event",
  ): void {
    const name = CSharpSyntax.name(item.childForFieldName("name"));
    if (name === undefined) {
      this.problem(
        "csharp-member-name",
        `A C# ${form} declaration has no statically readable name.`,
        "Use one ordinary named member declaration.",
        item,
      );
      return;
    }
    this.addDeclaration(
      item,
      item,
      this.documentationFor(item),
      [this.session.range(item)],
      name,
      form === "method" ? "function" : "property",
      form,
      [...owner.identity, name],
      this.memberAddresses(owner, name),
      owner.kind === "interface",
      CSharpSyntax.explicitInterface(item),
      owner.declarationId,
    );
  }

  private scanEnumMember(item: Node, owner: ICSharpTypeContext): void {
    const name = CSharpSyntax.name(item.childForFieldName("name"));
    if (name === undefined) return;
    this.addDeclaration(
      item,
      item,
      this.documentationFor(item),
      [this.session.range(item)],
      name,
      "property",
      "enum-member",
      [...owner.identity, name],
      this.memberAddresses(owner, name),
      true,
      false,
      owner.declarationId,
    );
  }

  private scanIndexer(item: Node, owner: ICSharpTypeContext): void {
    const name = "this[]";
    this.addDeclaration(
      item,
      item,
      this.documentationFor(item),
      [this.session.range(item)],
      name,
      "property",
      "indexer",
      [...owner.identity, name],
      this.memberAddresses(owner, name),
      owner.kind === "interface",
      CSharpSyntax.explicitInterface(item),
      owner.declarationId,
    );
  }

  private scanOperator(item: Node, owner: ICSharpTypeContext): void {
    const name = CSharpSyntax.operatorName(item);
    if (name === undefined) {
      this.problem(
        "csharp-operator-name",
        "A C# operator declaration has no statically readable operator token.",
        "Use a grammar-supported operator declaration.",
        item,
      );
      return;
    }
    this.addDeclaration(
      item,
      item,
      this.documentationFor(item),
      [this.session.range(item)],
      name,
      "function",
      "operator",
      [...owner.identity, name],
      this.memberAddresses(owner, name),
      owner.kind === "interface",
      CSharpSyntax.explicitInterface(item),
      owner.declarationId,
    );
  }

  private scanConversionOperator(item: Node, owner: ICSharpTypeContext): void {
    const name = CSharpSyntax.conversionOperatorName(item);
    if (name === undefined) {
      this.problem(
        "csharp-conversion-name",
        "A C# conversion operator has no statically readable kind or destination type.",
        "Use a grammar-supported implicit or explicit conversion declaration.",
        item,
      );
      return;
    }
    this.addDeclaration(
      item,
      item,
      this.documentationFor(item),
      [this.session.range(item)],
      name,
      "function",
      "conversion-operator",
      [...owner.identity, name],
      this.memberAddresses(owner, name),
      owner.kind === "interface",
      CSharpSyntax.explicitInterface(item),
      owner.declarationId,
    );
  }

  private addDeclaration(
    item: Node,
    siteNode: Node,
    documentation: ICSharpDocumentation | undefined,
    content: IEvidenceSourceRange[],
    name: string,
    symbol: EvidenceProgrammingSymbol,
    form: CSharpDeclarationForm,
    identity: string[],
    addresses: ICSharpDeclarationAddress[],
    implicitPublic: boolean,
    explicitInterface: boolean,
    ownerDeclarationId?: string,
  ): ICSharpDeclaration {
    const site: IEvidenceUnitSite = {
      id: this.siteId(siteNode),
      file: this.source.physicalPath,
      range: this.text.range(
        documentation === undefined
          ? siteNode.startIndex
          : documentation.range.start.offset,
        siteNode.endIndex,
      ),
      content,
    };
    const declaration: ICSharpDeclaration = {
      id: `csharp:${this.source.id}:declaration:${form}:${item.startIndex}:${name}`,
      name,
      symbol,
      form,
      identity,
      addresses,
      site,
      accessibility: CSharpSyntax.accessibility(siteNode),
      implicitPublic,
      partial: CSharpSyntax.hasModifier(siteNode, "partial"),
      explicitInterface,
      ...(ownerDeclarationId === undefined ? {} : { ownerDeclarationId }),
    };
    this.declarations.push(declaration);
    if (documentation !== undefined)
      this.attach(documentation, declaration.id, site.id);
    return declaration;
  }

  private typeAddresses(
    bases: ICSharpDeclarationAddress[],
    name: string,
    identityName: string,
  ): ICSharpDeclarationAddress[] {
    const names = name === identityName ? [name] : [identityName, name];
    return bases.flatMap((base) =>
      names.map((entry) => {
        const segments = [...base.segments, entry];
        return {
          segments,
          canonical: base.canonical && entry === identityName,
          aliasPrefixes:
            entry === identityName
              ? base.aliasPrefixes
              : [...base.aliasPrefixes, segments],
        };
      }),
    );
  }

  private memberAddresses(
    owner: ICSharpTypeContext,
    name: string,
  ): ICSharpDeclarationAddress[] {
    return owner.addresses.map((address) => ({
      segments: [...address.segments, name],
      canonical: address.canonical,
      aliasPrefixes: address.aliasPrefixes,
    }));
  }

  private documentationFor(node: Node): ICSharpDocumentation | undefined {
    const previous = node.previousNamedSibling;
    if (previous === null || !CSharpSyntax.isXmlDocumentation(previous))
      return undefined;
    const documentation = this.carrierDocumentation.get(this.nodeKey(previous));
    const gap =
      documentation === undefined
        ? ""
        : this.source.content.slice(
            documentation.range.end.offset,
            node.startIndex,
          );
    if (
      documentation === undefined ||
      documentation.range.start.column !== node.startPosition.column + 1 ||
      !/^\s*$/u.test(gap) ||
      /\r?\n[ \t]*\r?\n/u.test(gap)
    )
      return undefined;
    return documentation;
  }

  private collectDocumentation(): void {
    const comments = this.session.root
      .descendantsOfType("comment")
      .sort((left, right) => left.startIndex - right.startIndex);
    const consumed = new Set<string>();
    for (const first of comments) {
      if (consumed.has(this.nodeKey(first))) continue;
      const sequence: Node[] = [first];
      consumed.add(this.nodeKey(first));
      let last = first;
      if (first.text.startsWith("//")) {
        let next = last.nextNamedSibling;
        while (
          next !== null &&
          next.type === "comment" &&
          next.text.startsWith("///") === first.text.startsWith("///") &&
          next.startPosition.column === first.startPosition.column &&
          /^\s*$/u.test(
            this.source.content.slice(last.endIndex, next.startIndex),
          ) &&
          !/\r?\n[ \t]*\r?\n/u.test(
            this.source.content.slice(last.endIndex, next.startIndex),
          )
        ) {
          sequence.push(next);
          consumed.add(this.nodeKey(next));
          last = next;
          next = last.nextNamedSibling;
        }
      }
      const range = this.text.range(first.startIndex, last.endIndex);
      const syntax = CSharpSyntax.comment(first);
      const supported = CSharpSyntax.isXmlDocumentation(first);
      const raw = EvidenceDocumentation.read(
        this.source.content,
        "csharp-probe",
        range,
        syntax,
      ).text;
      if (!supported && !this.annotation(raw)) continue;
      const documentation = this.ensureDocumentation(range, syntax);
      for (const comment of sequence)
        this.carrierDocumentation.set(this.nodeKey(comment), documentation);
    }

    const literals = new Map<string, Node>();
    for (const type of [
      "string_literal",
      "verbatim_string_literal",
      "raw_string_literal",
      "interpolated_string_expression",
    ])
      for (const literal of this.session.root.descendantsOfType(type))
        literals.set(this.nodeKey(literal), literal);
    for (const literal of literals.values()) {
      const syntax = CSharpSyntax.string(literal);
      if (syntax === undefined) continue;
      const range = this.session.range(literal);
      const raw = EvidenceDocumentation.read(
        this.source.content,
        "csharp-probe",
        range,
        syntax,
      ).text;
      if (this.annotation(raw)) this.ensureDocumentation(range, syntax);
    }
  }

  private attach(
    documentation: ICSharpDocumentation,
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
    range: IEvidenceSourceRange,
    syntax: IEvidenceCommentSyntax,
  ): ICSharpDocumentation {
    const key = `${range.start.offset}:${range.end.offset}`;
    let documentation = this.documentation.get(key);
    if (documentation === undefined) {
      documentation = {
        id: `csharp:${this.source.id}:documentation:${key}`,
        range,
        syntax,
        attachments: [],
      };
      this.documentation.set(key, documentation);
    }
    return documentation;
  }

  private annotation(raw: string): boolean {
    return /(?:^|[\r\n])[ \t]*@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link|internal|hidden|ignore)\b/u.test(
      raw,
    );
  }

  private nodeKey(node: Node): string {
    return `${node.startIndex}:${node.endIndex}`;
  }

  private siteId(node: Node): string {
    return `csharp:${this.source.id}:site:${this.nodeKey(node)}`;
  }

  private problem(
    code: string,
    message: string,
    repair: string,
    node: Node,
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
