import path from "node:path";

import type { Node } from "web-tree-sitter";

import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { GoDeclarationForm } from "./GoDeclarationForm";
import { GoSyntax } from "./GoSyntax";
import type { IGoDeclaration } from "./IGoDeclaration";
import type { IGoDocumentation } from "./IGoDocumentation";
import type { IGoFileAnalysis } from "./IGoFileAnalysis";
import { SourcePath } from "../../internal/SourcePath";
import { SourceText } from "../../internal/SourceText";

/**
 * Extracts Go declarations and documentation before package-wide ownership resolution.
 *
 * It keeps physical sites and comment adjacency local to the file while
 * `GoAdapter` assigns receiver members to their package-wide semantic owners.
 */
export class GoFileScanner {
  private readonly declarations: IGoDeclaration[] = [];
  private readonly documentation = new Map<string, IGoDocumentation>();
  private readonly commentDocumentation = new Map<string, IGoDocumentation>();
  private readonly diagnostics: IEvidenceDiagnostic[] = [];
  private readonly reported = new Set<string>();
  private readonly text: SourceText;
  private complete = true;

  /**
   * Creates a scanner for one Go parse session and selected source file.
   *
   * Comment runs are captured first because Go documentation attachment depends
   * on exact source adjacency rather than declaration-family reconciliation.
   */
  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
  ) {
    this.text = new SourceText(source.content);
    this.collectCommentRuns();
  }

  /**
   * Extracts the package clause and supported exported declarations from one file.
   *
   * A missing package clause or unsupported relevant form is retained as an
   * incomplete analysis so package materialization cannot hide it.
   */
  public scan(): IGoFileAnalysis {
    const packageClause = this.session.root.namedChildren.find(
      (node) => node.type === "package_clause",
    );
    const packageName = GoSyntax.name(
      packageClause === undefined
        ? null
        : (packageClause.namedChildren[0] ?? null),
    );
    if (packageName === undefined)
      this.problem(
        "go-package",
        "The Go source has no statically readable package clause.",
        "Add one valid package clause before declaring public package members.",
        packageClause ?? this.session.root,
      );

    for (const statement of this.session.root.namedChildren)
      switch (statement.type) {
        case "type_declaration":
          this.scanTypes(statement);
          break;
        case "function_declaration":
          this.scanFunction(statement);
          break;
        case "method_declaration":
          this.scanMethod(statement);
          break;
        case "const_declaration":
        case "var_declaration":
          this.scanProperties(statement);
          break;
      }
    this.collectLiteralAnnotations();
    return {
      source: this.source,
      directory: SourcePath.slash(path.dirname(this.source.physicalPath)),
      ...(packageName === undefined ? {} : { packageName }),
      testFile: this.source.physicalPath.endsWith("_test.go"),
      declarations: this.declarations,
      documentation: Array.from(this.documentation.values()),
      diagnostics: this.diagnostics,
      complete: this.complete,
    };
  }

  private scanTypes(statement: Node): void {
    const specs = statement.namedChildren.filter(
      (node) => node.type === "type_spec" || node.type === "type_alias",
    );
    for (const spec of specs) {
      const name = GoSyntax.name(spec.childForFieldName("name"));
      if (name === undefined || !GoSyntax.exported(name)) continue;
      const form: GoDeclarationForm =
        spec.type === "type_alias" ? "type-alias" : "defined-type";
      this.addDeclaration(statement, spec, name, "type", form);
      const value = spec.childForFieldName("type");
      if (value?.type === "struct_type") this.scanStruct(value, name);
      else if (value?.type === "interface_type")
        this.scanInterface(value, name);
    }
  }

  private scanStruct(structure: Node, owner: string): void {
    const body = structure.namedChildren.find(
      (node) => node.type === "field_declaration_list",
    );
    for (const field of body?.namedChildren ?? []) {
      if (field.type !== "field_declaration") continue;
      const declared = GoSyntax.names(field, "field_identifier");
      const names =
        declared.length !== 0
          ? declared
          : [GoSyntax.embeddedField(field.childForFieldName("type"))].filter(
              (name) => name !== undefined,
            );
      if (declared.length === 0 && names.length === 0)
        this.problem(
          "go-embedded-field",
          `Struct '${owner}' has an embedded field whose declared name cannot be established.`,
          "Use a named field or a direct named, pointer, qualified, or generic embedded type.",
          field,
        );
      for (const name of names)
        if (GoSyntax.exported(name))
          this.addDeclaration(field, field, name, "property", "field", owner);
    }
  }

  private scanInterface(contract: Node, owner: string): void {
    for (const member of contract.namedChildren) {
      if (member.type !== "method_elem") continue;
      const name = GoSyntax.name(member.childForFieldName("name"));
      if (name !== undefined && GoSyntax.exported(name))
        this.addDeclaration(
          member,
          member,
          name,
          "function",
          "interface-method",
          owner,
        );
    }
  }

  private scanFunction(statement: Node): void {
    const name = GoSyntax.name(statement.childForFieldName("name"));
    if (name !== undefined && GoSyntax.exported(name))
      this.addDeclaration(statement, statement, name, "function", "function");
  }

  private scanMethod(statement: Node): void {
    const name = GoSyntax.name(statement.childForFieldName("name"));
    if (name === undefined || !GoSyntax.exported(name)) return;
    const owner = GoSyntax.receiver(statement);
    if (owner === undefined) {
      this.problem(
        "go-receiver",
        `Exported method '${name}' has no statically readable named receiver.`,
        "Declare the method on a local named type with an optional pointer or generic receiver.",
        statement,
      );
      return;
    }
    if (!GoSyntax.exported(owner)) return;
    this.addDeclaration(
      statement,
      statement,
      name,
      "function",
      "method",
      owner,
    );
  }

  private scanProperties(statement: Node): void {
    const specification =
      statement.type === "const_declaration" ? "const_spec" : "var_spec";
    for (const spec of statement.descendantsOfType(specification))
      for (const name of GoSyntax.names(spec, "identifier"))
        if (GoSyntax.exported(name))
          this.addDeclaration(statement, spec, name, "property", "property");
  }

  private addDeclaration(
    group: Node,
    position: Node,
    name: string,
    symbol: EvidenceProgrammingSymbol,
    form: GoDeclarationForm,
    owner?: string,
  ): void {
    const identity = owner === undefined ? [name] : [owner, name];
    const declarationId = `go:${this.source.id}:declaration:${symbol}:${JSON.stringify(identity)}:${position.startIndex}`;
    const content = this.session.range(position);
    const grouped = !group.equals(position);
    const groupSite = this.site(group, grouped ? [] : [content]);
    const positionSite = grouped ? this.site(position, [content]) : groupSite;
    const sites =
      groupSite.id === positionSite.id
        ? [groupSite]
        : [groupSite, positionSite];
    this.declarations.push({
      id: declarationId,
      name,
      symbol,
      form,
      ...(owner === undefined ? {} : { owner }),
      positionSiteId: positionSite.id,
      sites,
    });
    this.attachPreceding(group, declarationId, groupSite.id);
    if (!group.equals(position))
      this.attachPreceding(position, declarationId, positionSite.id);
  }

  private site(node: Node, content: IEvidenceSourceRange[]): IEvidenceUnitSite {
    return {
      id: this.siteId(node),
      file: this.source.physicalPath,
      range: this.session.range(node),
      content,
    };
  }

  private attachPreceding(
    node: Node,
    declarationId: string,
    siteId: string,
  ): void {
    const previous = node.previousNamedSibling;
    if (
      previous === null ||
      previous.type !== "comment" ||
      previous.startPosition.column !== node.startPosition.column
    )
      return;
    const documentation = this.commentDocumentation.get(this.nodeKey(previous));
    if (
      documentation === undefined ||
      !this.standalone(documentation.range.start.offset)
    )
      return;
    if (
      /\r?\n[ \t]*\r?\n/u.test(
        this.source.content.slice(
          documentation.range.end.offset,
          node.startIndex,
        ),
      )
    )
      return;
    if (
      !documentation.attachments.some(
        (attachment) =>
          attachment.declarationId === declarationId &&
          attachment.siteId === siteId,
      )
    )
      documentation.attachments.push({ declarationId, siteId });
  }

  private collectCommentRuns(): void {
    const comments = this.session.root
      .descendantsOfType("comment")
      .sort((left, right) => left.startIndex - right.startIndex);
    const consumed = new Set<string>();
    for (const first of comments) {
      if (consumed.has(this.nodeKey(first))) continue;
      const sequence: Node[] = [first];
      consumed.add(this.nodeKey(first));
      let last = first;
      if (first.text.startsWith("//") && this.standalone(first.startIndex)) {
        let next = last.nextNamedSibling;
        while (
          next !== null &&
          next.type === "comment" &&
          next.text.startsWith("//") &&
          this.standalone(next.startIndex) &&
          next.startPosition.column === first.startPosition.column &&
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
      const documentation = this.ensureDocumentation(
        range,
        GoSyntax.comment(first),
      );
      for (const comment of sequence)
        this.commentDocumentation.set(this.nodeKey(comment), documentation);
    }
  }

  /**
   * Keeps trailing source comments separate from the next declaration's documentation.
   *
   * Go attaches documentation only from the leading comment run, so a preceding
   * declaration's trailing comment must not become evidence for the next one.
   */
  private standalone(offset: number): boolean {
    const start = this.source.content.lastIndexOf("\n", offset - 1) + 1;
    return /^[ \t]*$/u.test(this.source.content.slice(start, offset));
  }

  private collectLiteralAnnotations(): void {
    const literals = [
      ...this.session.root.descendantsOfType("interpreted_string_literal"),
      ...this.session.root.descendantsOfType("raw_string_literal"),
    ];
    for (const literal of literals) {
      const syntax = GoSyntax.literal(literal);
      if (syntax === undefined) continue;
      const raw = this.source.content.slice(
        literal.startIndex + syntax.opening.length,
        literal.endIndex - syntax.closing.length,
      );
      if (this.annotation(raw))
        this.ensureDocumentation(this.session.range(literal), syntax);
    }
  }

  private ensureDocumentation(
    range: IEvidenceSourceRange,
    syntax: IEvidenceCommentSyntax,
  ): IGoDocumentation {
    const key = `${range.start.offset}:${range.end.offset}`;
    let documentation = this.documentation.get(key);
    if (documentation === undefined) {
      documentation = {
        id: `go:${this.source.id}:documentation:${key}`,
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
    return `go:${this.source.id}:site:${this.nodeKey(node)}`;
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
