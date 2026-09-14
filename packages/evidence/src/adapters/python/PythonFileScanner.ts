import type { Node } from "web-tree-sitter";

import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";
import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { IPythonAll } from "./IPythonAll";
import type { IPythonBinding } from "./IPythonBinding";
import type { IPythonClassContext } from "./IPythonClassContext";
import type { IPythonDocumentation } from "./IPythonDocumentation";
import type { IPythonFileAnalysis } from "./IPythonFileAnalysis";
import type { IPythonHostPosition } from "./IPythonHostPosition";
import type { IPythonOwnedUnit } from "./IPythonOwnedUnit";
import { PythonSyntax } from "./PythonSyntax";
import { SourceText } from "../../internal/SourceText";

/** Extracts Python declarations and static module bindings before export traversal. */
export class PythonFileScanner {
  private readonly all: IPythonAll = { state: "absent", names: [] };
  private readonly bindings: IPythonBinding[] = [];
  private readonly units = new Map<string, IPythonOwnedUnit>();
  private readonly positions = new Map<string, IPythonHostPosition>();
  private readonly documentation = new Map<string, IPythonDocumentation>();
  private readonly commentDocumentation = new Map<
    string,
    IPythonDocumentation
  >();
  private readonly diagnostics: IEvidenceDiagnostic[] = [];
  private readonly reported = new Set<string>();
  private readonly docstringParts = new Set<string>();
  private readonly text: SourceText;
  private complete = true;

  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
  ) {
    this.text = new SourceText(source.content);
    this.collectCommentRuns();
  }

  public scan(): IPythonFileAnalysis {
    const statements = this.session.root.namedChildren.filter(
      (statement) => statement.type !== "comment",
    );
    for (const statement of statements) {
      const handled = this.scanAll(statement);
      if (!handled && this.containsAllMutation(statement))
        this.dynamicAll(statement);
    }
    for (const statement of statements) {
      if (statement.type === "comment") continue;
      if (this.scanImport(statement)) continue;

      const definition = PythonSyntax.definition(statement);
      switch (definition.type) {
        case "class_definition":
          this.scanClass(statement, definition);
          break;
        case "function_definition":
          this.scanFunction(statement, definition);
          break;
        case "type_alias_statement":
          this.scanTypeAlias(statement, definition);
          break;
        case "expression_statement":
          this.scanModuleExpression(statement);
          break;
        default:
          if (this.containsModuleSurface(statement))
            this.problem(
              "python-dynamic-surface",
              "A control-flow statement conditionally changes the module's declared public surface.",
              "Move public declarations and imports to unconditional module scope.",
              statement,
            );
      }
    }
    this.collectStringAnnotations();
    return {
      source: this.source,
      all: this.all,
      bindings: this.bindings,
      units: Array.from(this.units.values()),
      positions: Array.from(this.positions.values()),
      documentation: Array.from(this.documentation.values()),
      diagnostics: this.diagnostics,
      complete: this.complete,
    };
  }

  private scanAll(statement: Node): boolean {
    if (statement.type !== "expression_statement") return false;
    const expression = statement.namedChildren[0];
    if (expression?.type === "assignment") {
      if (PythonSyntax.assignmentName(expression) !== "__all__") return false;
      const names = PythonSyntax.literalSequence(
        expression.childForFieldName("right"),
      );
      if (names === undefined) this.dynamicAll(expression);
      else {
        this.all.state = "static";
        this.all.names = names;
      }
      return true;
    }
    if (expression?.type === "augmented_assignment") {
      if (PythonSyntax.assignmentName(expression) !== "__all__") return false;
      const names = PythonSyntax.literalSequence(
        expression.childForFieldName("right"),
      );
      if (this.all.state !== "static" || names === undefined)
        this.dynamicAll(expression);
      else this.all.names.push(...names);
      return true;
    }
    return false;
  }

  private scanImport(statement: Node): boolean {
    if (statement.type === "import_statement") {
      statement.namedChildren.forEach((entry, index) => {
        if (entry.type === "aliased_import") {
          const imported = entry.childForFieldName("name")?.text;
          const local = PythonSyntax.name(entry.childForFieldName("alias"));
          if (imported !== undefined && local !== undefined)
            this.bindings.push({
              kind: "namespace",
              order: statement.startIndex + index,
              localName: local,
              specifier: imported,
            });
        } else if (entry.type === "dotted_name") {
          const imported = entry.text;
          const local = imported.split(".")[0];
          if (local !== undefined)
            this.bindings.push({
              kind: "namespace",
              order: statement.startIndex + index,
              localName: local,
              specifier: local,
            });
        }
      });
      return true;
    }
    if (statement.type !== "import_from_statement") return false;
    const module = statement.childForFieldName("module_name");
    const specifier = module?.text;
    if (specifier === undefined) {
      this.problem(
        "python-import",
        "A from-import has no statically readable module name.",
        "Use an absolute or explicit relative module name inside the configured root.",
        statement,
      );
      return true;
    }
    if (specifier === "__future__") return true;
    if (
      statement.namedChildren.some((child) => child.type === "wildcard_import")
    ) {
      this.bindings.push({
        kind: "star",
        order: statement.startIndex,
        specifier,
      });
      return true;
    }
    let index = 0;
    for (const entry of statement.namedChildren) {
      if (module !== null && entry.equals(module)) continue;
      if (entry.type === "aliased_import") {
        const imported = entry.childForFieldName("name")?.text;
        const local = PythonSyntax.name(entry.childForFieldName("alias"));
        if (imported !== undefined && local !== undefined)
          this.bindings.push({
            kind: "named",
            order: statement.startIndex + index++,
            localName: local,
            importedName: imported,
            specifier,
          });
      } else if (entry.type === "dotted_name") {
        this.bindings.push({
          kind: "named",
          order: statement.startIndex + index++,
          localName: entry.text,
          importedName: entry.text,
          specifier,
        });
      }
    }
    return true;
  }

  private scanClass(
    wrapper: Node,
    definition: Node,
    parent?: IPythonClassContext,
  ): void {
    const name = PythonSyntax.name(definition.childForFieldName("name"));
    if (name === undefined || (parent !== undefined && this.private(name)))
      return;
    const root = parent?.root ?? this.rootToken(name, wrapper);
    const identity = [...(parent?.identity ?? []), name];
    const suffix = parent === undefined ? [] : [...parent.suffix, name];
    const body = definition.childForFieldName("body");
    const headerEnd = body?.startIndex ?? definition.endIndex;
    const record = this.addUnit(
      wrapper,
      definition,
      "type",
      identity,
      root,
      suffix,
      parent?.parentId,
      this.text.range(wrapper.startIndex, headerEnd),
    );
    if (parent === undefined) this.bindLocal(name, wrapper.startIndex, root);
    if (body === null) return;
    const context: IPythonClassContext = {
      identity,
      suffix,
      root,
      parentId: record.unit.id,
    };
    for (const statement of body.namedChildren) {
      if (statement.type === "comment") continue;
      const child = PythonSyntax.definition(statement);
      switch (child.type) {
        case "class_definition":
          this.scanClass(statement, child, context);
          break;
        case "function_definition":
          this.scanMethod(statement, child, context);
          break;
        case "type_alias_statement":
          this.scanTypeAlias(statement, child, context);
          break;
        case "expression_statement":
          this.scanClassExpression(statement, context);
          break;
        default:
          if (this.containsClassSurface(statement))
            this.problem(
              "python-dynamic-class-surface",
              `Control flow conditionally changes the declared surface of class '${name}'.`,
              "Move public nested declarations and class attributes to unconditional class scope.",
              statement,
            );
      }
    }
  }

  private scanFunction(wrapper: Node, definition: Node): void {
    const name = PythonSyntax.name(definition.childForFieldName("name"));
    if (name === undefined) return;
    const root = this.rootToken(name, wrapper);
    this.addUnit(
      wrapper,
      definition,
      "function",
      [name],
      root,
      [],
      undefined,
      this.session.range(wrapper),
    );
    this.bindLocal(name, wrapper.startIndex, root);
  }

  private scanMethod(
    wrapper: Node,
    definition: Node,
    context: IPythonClassContext,
  ): void {
    const name = PythonSyntax.name(definition.childForFieldName("name"));
    if (name === undefined) return;
    if (name === "__init__") {
      this.scanInstanceFields(definition, context);
      return;
    }
    if (this.private(name)) return;
    const decorators = PythonSyntax.decoratorNames(wrapper);
    const direct = decorators.some(
      (decorator) =>
        decorator === "staticmethod" || decorator === "classmethod",
    );
    const property = decorators.some(
      (decorator) =>
        decorator === "property" ||
        decorator === "cached_property" ||
        decorator === "functools.cached_property" ||
        decorator.endsWith(".getter") ||
        decorator.endsWith(".setter") ||
        decorator.endsWith(".deleter"),
    );
    const ownership = direct ? [] : ["prototype"];
    this.addUnit(
      wrapper,
      definition,
      property ? "property" : "function",
      [...context.identity, ...ownership, name],
      context.root,
      [...context.suffix, ...ownership, name],
      context.parentId,
      this.session.range(wrapper),
    );
  }

  private scanTypeAlias(
    wrapper: Node,
    definition: Node,
    context?: IPythonClassContext,
  ): void {
    const name = PythonSyntax.typeAliasName(definition);
    if (name === undefined || (context !== undefined && this.private(name)))
      return;
    const root = context?.root ?? this.rootToken(name, wrapper);
    this.addUnit(
      wrapper,
      definition,
      "type",
      [...(context?.identity ?? []), name],
      root,
      context === undefined ? [] : [...context.suffix, name],
      context?.parentId,
      this.session.range(wrapper),
    );
    if (context === undefined) this.bindLocal(name, wrapper.startIndex, root);
  }

  private scanModuleExpression(statement: Node): void {
    const expression = statement.namedChildren[0];
    if (expression?.type === "assignment")
      this.scanAssignments(statement, expression);
    else if (expression?.type === "augmented_assignment")
      this.scanAugmentedAssignment(statement, expression);
  }

  private scanClassExpression(
    statement: Node,
    context: IPythonClassContext,
  ): void {
    const expression = statement.namedChildren[0];
    if (expression?.type === "assignment")
      this.scanAssignments(statement, expression, context);
    else if (expression?.type === "augmented_assignment")
      this.scanAugmentedAssignment(statement, expression, context);
  }

  private scanAugmentedAssignment(
    statement: Node,
    assignment: Node,
    context?: IPythonClassContext,
  ): void {
    const name = PythonSyntax.assignmentName(assignment);
    if (
      name === undefined ||
      name === "__all__" ||
      (context !== undefined && this.private(name))
    )
      return;
    const root =
      context?.root ??
      this.currentLocalRoot(name) ??
      this.rootToken(name, statement);
    this.addUnit(
      statement,
      assignment,
      "property",
      [...(context?.identity ?? []), name],
      root,
      context === undefined ? [] : [...context.suffix, name],
      context?.parentId,
      this.session.range(assignment),
    );
    if (context === undefined) this.bindLocal(name, statement.startIndex, root);
  }

  private scanAssignments(
    statement: Node,
    assignment: Node,
    context?: IPythonClassContext,
  ): void {
    let current: Node | null = assignment;
    let unsupported = false;
    while (current?.type === "assignment") {
      const left = current.childForFieldName("left");
      const name = PythonSyntax.assignmentName(current);
      if (name !== undefined) {
        if (context === undefined || !this.private(name)) {
          const root = context?.root ?? this.rootToken(name, current);
          const symbol: EvidenceProgrammingSymbol =
            PythonSyntax.typeAliasAnnotation(current) ? "type" : "property";
          this.addUnit(
            statement,
            current,
            symbol,
            [...(context?.identity ?? []), name],
            root,
            context === undefined ? [] : [...context.suffix, name],
            context?.parentId,
            this.session.range(current),
          );
          if (context === undefined)
            this.bindLocal(name, statement.startIndex, root);
        }
      } else if (this.selectedAssignment(left, context)) unsupported = true;
      current = current.childForFieldName("right");
    }
    if (unsupported)
      this.problem(
        "python-binding-pattern",
        "A destructuring assignment creates public names outside the supported simple-identifier form.",
        "Declare each public module or class attribute with its own identifier assignment.",
        assignment,
      );
  }

  private scanInstanceFields(
    definition: Node,
    context: IPythonClassContext,
  ): void {
    const receiver = PythonSyntax.parameterName(definition);
    const body = definition.childForFieldName("body");
    if (receiver === undefined || body === null) return;
    for (const statement of body.namedChildren) {
      if (statement.type === "comment") continue;
      if (statement.type === "expression_statement") {
        let assignment: Node | null = statement.namedChildren[0] ?? null;
        while (assignment?.type === "assignment") {
          const left = assignment.childForFieldName("left");
          const name =
            left !== null && PythonSyntax.attributeObject(left) === receiver
              ? PythonSyntax.attributeName(left)
              : undefined;
          if (name !== undefined && !this.private(name))
            this.addUnit(
              statement,
              assignment,
              "property",
              [...context.identity, "prototype", name],
              context.root,
              [...context.suffix, "prototype", name],
              context.parentId,
              this.session.range(assignment),
            );
          else if (this.receiverAttributes(left, receiver).length !== 0)
            this.problem(
              "python-binding-pattern",
              "A destructuring assignment declares instance fields outside the supported direct receiver form.",
              "Assign each public instance field with its own direct receiver-name assignment.",
              assignment,
            );
          assignment = assignment.childForFieldName("right");
        }
        if (
          assignment?.type === "augmented_assignment" &&
          this.receiverAttributes(
            assignment.childForFieldName("left"),
            receiver,
          ).length !== 0
        )
          this.problem(
            "python-dynamic-instance-field",
            "An augmented receiver assignment cannot establish a declared instance field.",
            "Initialize each public instance field with a direct assignment in __init__.",
            assignment,
          );
      } else if (this.containsReceiverAssignment(statement, receiver))
        this.problem(
          "python-dynamic-instance-field",
          "A conditional or nested statement declares an instance field outside the supported constructor form.",
          "Move the public self-field assignment directly into __init__ or add explicit adapter support for this flow.",
          statement,
        );
    }
  }

  private addUnit(
    wrapper: Node,
    definition: Node,
    symbol: EvidenceProgrammingSymbol,
    identity: string[],
    root: string,
    suffix: string[],
    parentId: string | undefined,
    content: IEvidenceSourceRange,
  ): IPythonOwnedUnit {
    const id = `python:${this.source.id}:${symbol}:${JSON.stringify(identity)}`;
    const siteId = this.siteId(wrapper);
    const site: IEvidenceUnitSite = {
      id: siteId,
      file: this.source.physicalPath,
      range: this.session.range(wrapper),
      content: [content],
    };
    let record = this.units.get(id);
    if (record === undefined) {
      const unit: IEvidenceUnit = {
        id,
        type: "python",
        symbol,
        identity,
        name: identity.at(-1) ?? "",
        sites: [site],
        withdrawals: [],
        ...(parentId === undefined ? {} : { parentId }),
      };
      record = { unit, roots: [root], suffix };
      this.units.set(id, record);
    } else {
      if (!record.roots.includes(root)) record.roots.push(root);
      const previous = record.unit.sites.find(
        (candidate) => candidate.id === site.id,
      );
      if (previous === undefined) record.unit.sites.push(site);
      else previous.content.push(content);
    }
    this.registerPosition(wrapper, siteId, id);
    this.attachPrecedingComment(wrapper, siteId, id);
    this.attachDocstring(definition, siteId, id);
    return record;
  }

  private registerPosition(node: Node, siteId: string, unitId: string): void {
    const id = this.positionId(node);
    let position = this.positions.get(id);
    if (position === undefined) {
      position = {
        id,
        siteId,
        range: this.session.range(node),
        unitIds: [],
      };
      this.positions.set(id, position);
    }
    if (!position.unitIds.includes(unitId)) position.unitIds.push(unitId);
  }

  private attachPrecedingComment(
    node: Node,
    siteId: string,
    unitId: string,
  ): void {
    const previous = node.previousNamedSibling;
    if (
      previous === null ||
      previous.type !== "comment" ||
      previous.startPosition.column !== node.startPosition.column
    )
      return;
    const documentation = this.commentDocumentation.get(this.nodeKey(previous));
    if (documentation === undefined) return;
    if (
      /\r?\n[ \t]*\r?\n/u.test(
        this.source.content.slice(
          documentation.range.end.offset,
          node.startIndex,
        ),
      )
    )
      return;
    this.attach(documentation, this.positionId(node), siteId, unitId);
  }

  private attachDocstring(
    definition: Node,
    siteId: string,
    unitId: string,
  ): void {
    const value = PythonSyntax.docstring(definition.childForFieldName("body"));
    if (value === undefined) return;
    const parts = PythonSyntax.docstringParts(value);
    if (parts === undefined) return;
    for (const part of parts) this.docstringParts.add(this.nodeKey(part));
    const documentation =
      parts.length === 1
        ? this.ensureStringDocumentation(value)
        : this.ensureConcatenatedDocumentation(value, parts);
    if (documentation === undefined) return;
    this.attach(
      documentation,
      this.positionId(
        definition.parent?.type === "decorated_definition"
          ? definition.parent
          : definition,
      ),
      siteId,
      unitId,
    );
  }

  private attach(
    documentation: IPythonDocumentation,
    positionId: string,
    siteId: string,
    unitId: string,
  ): void {
    if (
      documentation.attachments.some(
        (entry) =>
          entry.positionId === positionId &&
          entry.siteId === siteId &&
          entry.unitId === unitId,
      )
    )
      return;
    documentation.attachments.push({ positionId, siteId, unitId });
  }

  private collectCommentRuns(): void {
    const blocks = [
      this.session.root,
      ...this.session.root.descendantsOfType("block"),
    ];
    for (const block of blocks) {
      const children = block.namedChildren;
      for (let index = 0; index < children.length; ++index) {
        const first = children[index];
        if (first?.type !== "comment") continue;
        const comments: Node[] = [first];
        let last = first;
        while (index + 1 < children.length) {
          const next = children[index + 1];
          if (
            next?.type !== "comment" ||
            next.startPosition.column !== first.startPosition.column ||
            /\r?\n[ \t]*\r?\n/u.test(
              this.source.content.slice(last.endIndex, next.startIndex),
            )
          )
            break;
          comments.push(next);
          last = next;
          ++index;
        }
        const range = this.text.range(first.startIndex, last.endIndex);
        const documentation = this.ensureDocumentationRange(
          range,
          PythonSyntax.commentSyntax(),
        );
        for (const comment of comments)
          this.commentDocumentation.set(this.nodeKey(comment), documentation);
      }
    }
  }

  private collectStringAnnotations(): void {
    for (const string of this.session.root.descendantsOfType("string")) {
      if (this.docstringParts.has(this.nodeKey(string))) continue;
      const syntax = PythonSyntax.stringSyntax(string);
      if (syntax === undefined) continue;
      const raw = this.source.content.slice(
        string.startIndex + syntax.opening.length,
        string.endIndex - syntax.closing.length,
      );
      if (this.annotation(raw)) this.ensureDocumentation(string, syntax);
    }
  }

  private ensureStringDocumentation(
    node: Node,
  ): IPythonDocumentation | undefined {
    const syntax = PythonSyntax.stringSyntax(node);
    return syntax === undefined
      ? undefined
      : this.ensureDocumentation(node, syntax);
  }

  private ensureConcatenatedDocumentation(
    node: Node,
    parts: Node[],
  ): IPythonDocumentation {
    const range = this.session.range(node);
    const key = `${range.start.offset}:${range.end.offset}`;
    let documentation = this.documentation.get(key);
    if (documentation !== undefined) return documentation;
    const id = `python:${this.source.id}:documentation:${key}`;
    let text = "";
    const offsets: number[] = [];
    const ends: number[] = [];
    let boundary = range.end.offset;
    for (const part of parts) {
      const syntax = PythonSyntax.stringSyntax(part);
      if (syntax === undefined) continue;
      const mapped = EvidenceDocumentation.read(
        this.source.content,
        id,
        this.session.range(part),
        syntax,
      );
      text += mapped.text;
      offsets.push(...mapped.offsets.slice(0, -1));
      ends.push(...mapped.ends);
      boundary = mapped.offsets.at(-1) ?? boundary;
    }
    offsets.push(boundary);
    documentation = {
      id,
      range,
      mapping: {
        hostId: id,
        text,
        offsets,
        ends,
        tagBoundaries: true,
        allowWithdrawal: true,
      },
      attachments: [],
    };
    this.documentation.set(key, documentation);
    return documentation;
  }

  private ensureDocumentation(
    node: Node,
    syntax: IEvidenceCommentSyntax,
  ): IPythonDocumentation {
    return this.ensureDocumentationRange(this.session.range(node), syntax);
  }

  private ensureDocumentationRange(
    range: IEvidenceSourceRange,
    syntax: IEvidenceCommentSyntax,
  ): IPythonDocumentation {
    const key = `${range.start.offset}:${range.end.offset}`;
    let documentation = this.documentation.get(key);
    if (documentation === undefined) {
      documentation = {
        id: `python:${this.source.id}:documentation:${key}`,
        range,
        syntax,
        attachments: [],
      };
      this.documentation.set(key, documentation);
    }
    return documentation;
  }

  private bindLocal(name: string, order: number, root: string): void {
    this.bindings.push({ kind: "local", localName: name, order, root });
  }

  private currentLocalRoot(name: string): string | undefined {
    return this.bindings.findLast(
      (binding) => binding.kind === "local" && binding.localName === name,
    )?.root;
  }

  private rootToken(name: string, node: Node): string {
    return `${name}:${node.startIndex}`;
  }

  private dynamicAll(node: Node): void {
    this.all.state = "dynamic";
    this.problem(
      "python-dynamic-all",
      "The module mutates __all__ with a form that cannot be resolved statically.",
      "Use a literal string list or tuple, literal '+' composition, and top-level '+=' additions.",
      node,
    );
  }

  private containsAllMutation(node: Node): boolean {
    const definition = PythonSyntax.definition(node);
    if (
      definition.type === "function_definition" ||
      definition.type === "class_definition"
    )
      return false;
    if (
      (node.type === "assignment" || node.type === "augmented_assignment") &&
      PythonSyntax.assignmentName(node) === "__all__"
    )
      return true;
    if (node.type === "delete_statement")
      return node
        .descendantsOfType("identifier")
        .some((identifier) => identifier.text === "__all__");
    if (node.type === "call") {
      const callable = node.childForFieldName("function");
      if (
        callable?.type === "attribute" &&
        PythonSyntax.attributeObject(callable) === "__all__"
      )
        return true;
    }
    return node.namedChildren.some((child) => this.containsAllMutation(child));
  }

  private containsModuleSurface(node: Node): boolean {
    const queue: Node[] = [node];
    for (let index = 0; index < queue.length; ++index) {
      const child = queue[index];
      if (child === undefined) continue;
      const definition = PythonSyntax.definition(child);
      if (
        definition.type === "class_definition" ||
        definition.type === "function_definition"
      ) {
        if (
          this.selectedModuleName(
            PythonSyntax.name(definition.childForFieldName("name")),
          )
        )
          return true;
        continue;
      }
      if (
        definition.type === "type_alias_statement" &&
        this.selectedModuleName(PythonSyntax.typeAliasName(definition))
      )
        return true;
      if (
        child.type === "import_statement" ||
        child.type === "import_from_statement"
      )
        if (this.conditionalImportSelected(child)) return true;
      if (
        child.type === "assignment" &&
        this.identifiers(child.childForFieldName("left")).some((name) =>
          this.selectedModuleName(name),
        )
      )
        return true;
      if (
        child.type === "augmented_assignment" &&
        this.selectedModuleName(PythonSyntax.assignmentName(child))
      )
        return true;
      if (
        child.type === "delete_statement" &&
        this.identifiers(child).some((name) => this.selectedModuleName(name))
      )
        return true;
      queue.push(...child.namedChildren);
    }
    return false;
  }

  private containsClassSurface(node: Node): boolean {
    const queue: Node[] = [node];
    for (let index = 0; index < queue.length; ++index) {
      const child = queue[index];
      if (child === undefined) continue;
      const definition = PythonSyntax.definition(child);
      const declarationName =
        definition.type === "type_alias_statement"
          ? PythonSyntax.typeAliasName(definition)
          : PythonSyntax.name(definition.childForFieldName("name"));
      if (
        (definition.type === "class_definition" ||
          definition.type === "function_definition" ||
          definition.type === "type_alias_statement") &&
        declarationName !== undefined &&
        !this.private(declarationName)
      )
        return true;
      if (
        definition.type === "class_definition" ||
        definition.type === "function_definition"
      )
        continue;
      if (
        (child.type === "assignment" ||
          child.type === "augmented_assignment" ||
          child.type === "delete_statement") &&
        this.publicIdentifiers(child).length !== 0
      )
        return true;
      queue.push(...child.namedChildren);
    }
    return false;
  }

  private selectedModuleName(name: string | undefined): boolean {
    if (name === undefined) return false;
    return this.all.state === "static"
      ? this.all.names.includes(name)
      : !this.private(name) || this.all.names.includes(name);
  }

  private conditionalImportSelected(statement: Node): boolean {
    if (
      statement.type === "import_from_statement" &&
      statement.namedChildren.some((child) => child.type === "wildcard_import")
    )
      return this.all.state !== "static" || this.all.names.length !== 0;
    const module = statement.childForFieldName("module_name");
    for (const entry of statement.namedChildren) {
      if (module !== null && entry.equals(module)) continue;
      const local =
        entry.type === "aliased_import"
          ? PythonSyntax.name(entry.childForFieldName("alias"))
          : entry.type === "dotted_name"
            ? entry.text.split(".")[0]
            : undefined;
      if (this.selectedModuleName(local)) return true;
    }
    return false;
  }

  private containsReceiverAssignment(node: Node, receiver: string): boolean {
    const mutations = [
      ...node.descendantsOfType("assignment"),
      ...node.descendantsOfType("augmented_assignment"),
      ...node.descendantsOfType("delete_statement"),
    ];
    return mutations.some((mutation) => {
      const target =
        mutation.type === "delete_statement"
          ? mutation
          : mutation.childForFieldName("left");
      return this.receiverAttributes(target, receiver).length !== 0;
    });
  }

  private receiverAttributes(node: Node | null, receiver: string): string[] {
    if (node === null) return [];
    const attributes =
      node.type === "attribute" ? [node] : node.descendantsOfType("attribute");
    return attributes.flatMap((attribute) => {
      const name = PythonSyntax.attributeName(attribute);
      return PythonSyntax.attributeObject(attribute) === receiver &&
        name !== undefined &&
        !this.private(name)
        ? [name]
        : [];
    });
  }

  private publicIdentifiers(node: Node | null): string[] {
    return this.identifiers(node).filter((name) => !this.private(name));
  }

  private selectedAssignment(
    node: Node | null,
    context: IPythonClassContext | undefined,
  ): boolean {
    const names = this.identifiers(node);
    return context === undefined
      ? names.some((name) => this.selectedModuleName(name))
      : names.some((name) => !this.private(name));
  }

  private identifiers(node: Node | null): string[] {
    if (node === null) return [];
    const identifiers =
      node.type === "identifier"
        ? [node]
        : node.descendantsOfType("identifier");
    return identifiers.map((identifier) => identifier.text);
  }

  private private(name: string): boolean {
    return name.startsWith("_");
  }

  private annotation(raw: string): boolean {
    return /(?:^|[\r\n])[ \t]*(?:#[ \t]*)?@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link|internal|hidden|ignore)\b/u.test(
      raw,
    );
  }

  private nodeKey(node: Node): string {
    return `${node.startIndex}:${node.endIndex}`;
  }

  private siteId(node: Node): string {
    return `python:${this.source.id}:site:${this.nodeKey(node)}`;
  }

  private positionId(node: Node): string {
    return `python:${this.source.id}:position:${this.nodeKey(node)}`;
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
