import type { Node as EvidNode } from "web-tree-sitter";

import type { EvidParseSession } from "../../parsers/EvidParseSession";
import { EvidDocumentation } from "../../parsers/EvidDocumentation";
import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { IEvidUnit } from "../../structures/IEvidUnit";
import type { IEvidUnitSite } from "../../structures/IEvidUnitSite";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";
import type { IEvidPythonAll } from "./IEvidPythonAll";
import type { IEvidPythonBinding } from "./IEvidPythonBinding";
import type { IEvidPythonClassContext } from "./IEvidPythonClassContext";
import type { IEvidPythonDocumentation } from "./IEvidPythonDocumentation";
import type { IEvidPythonFileAnalysis } from "./IEvidPythonFileAnalysis";
import type { IEvidPythonHostPosition } from "./IEvidPythonHostPosition";
import type { IEvidPythonOwnedUnit } from "./IEvidPythonOwnedUnit";
import { EvidPythonSyntax } from "./EvidPythonSyntax";
import { EvidSourceText } from "../../internal/EvidSourceText";

/**
 * Extracts Python declarations and static module bindings from one source file.
 *
 * This scanner classifies source-local public surface and documentation while a
 * later snapshot-wide resolver follows imports and publishes public addresses.
 */
export class EvidPythonFileScanner {
  /**
   * Records the file's statically understood `__all__` state and names.
   *
   * Dynamic mutations make the analysis incomplete rather than allowing the
   * export resolver to infer a smaller public surface.
   */
  private readonly all: IEvidPythonAll = { state: "absent", names: [] };

  /**
   * Collects ordered module bindings used by later export resolution.
   *
   * Binding order preserves Python shadowing semantics for imports and locals.
   */
  private readonly bindings: IEvidPythonBinding[] = [];

  /**
   * Owns the currently effective unit for each semantic identity in this file.
   *
   * Runtime rebindings replace the record, while property families and stub
   * overloads retain their language-established declaration sites.
   */
  private readonly units = new Map<string, IEvidPythonOwnedUnit>();

  /**
   * Effective class-dictionary unit for each owner and runtime binding name.
   *
   * Evid symbols and public address projections can differ for a method,
   * property, alias, or nested class even though Python assigns them through
   * one class namespace. The map lets a later statement remove the replaced
   * unit and its descendants before publication.
   */
  private readonly classBindings: Map<string, string> = new Map<
    string,
    string
  >();

  /**
   * Owns instance-field units produced by each class's effective constructor.
   *
   * A later `__init__` replaces the complete initializer body. Keeping its
   * generated units together lets the scanner discard fields that only the dead
   * constructor assigned before it scans the surviving body.
   */
  private readonly constructorUnits: Map<string, Set<string>> = new Map<
    string,
    Set<string>
  >();

  /**
   * Tracks declaration positions used to identify enclosing public hosts.
   *
   * Position records retain nesting information after parser nodes are
   * released.
   */
  private readonly positions = new Map<string, IEvidPythonHostPosition>();

  /**
   * Holds parsed comment and string documentation by extraction identity.
   *
   * Attachments are added as declarations are recognized instead of inferred
   * later from line adjacency.
   */
  private readonly documentation = new Map<string, IEvidPythonDocumentation>();

  /**
   * Indexes contiguous comment runs by their final one-based source line.
   *
   * A declaration can attach only to an immediately preceding standalone run.
   */
  private readonly commentDocumentation = new Map<
    number,
    IEvidPythonDocumentation
  >();

  /**
   * Collects diagnostics that describe unsupported public-surface constructs.
   *
   * They are returned with the file analysis so the adapter can retain failure
   * context after closing the parse session.
   */
  private readonly diagnostics: IEvidDiagnostic[] = [];

  /**
   * Remembers reported source decisions to avoid duplicate diagnostics.
   *
   * Several traversal predicates can encounter one unsupported node.
   */
  private readonly reported = new Set<string>();

  /**
   * Tracks string ranges already consumed as a concatenated docstring.
   *
   * This prevents adjacent string literals from producing overlapping mappings.
   */
  private readonly docstringParts = new Set<string>();

  /**
   * Converts parser offsets into source ranges for units and documentation.
   *
   * The scanner owns this helper because all returned records must outlive
   * nodes.
   */
  private readonly text: EvidSourceText;

  /**
   * States whether every surface-affecting construct was statically classified.
   *
   * Unsupported dynamic forms set this false so missing declarations cannot
   * reduce the inventory population.
   */
  private complete = true;

  /**
   * Binds the active parser session to the selected source snapshot.
   *
   * Comment runs are collected eagerly because later traversal intentionally
   * skips comments while classifying executable declarations.
   */
  public constructor(
    private readonly session: EvidParseSession,
    private readonly source: IEvidSourceFile,
  ) {
    this.text = new EvidSourceText(source.content);
    this.collectCommentRuns();
  }

  /**
   * Produces the serializable extraction result for this Python source file.
   *
   * The first pass establishes `__all__`; the second records declarations and
   * bindings, so public-name decisions do not depend on statement encounter
   * order.
   */
  public scan(): IEvidPythonFileAnalysis {
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

      const definition = EvidPythonSyntax.definition(statement);
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

  /**
   * Classifies one static `__all__` assignment or augmentation.
   *
   * Returns whether the statement owns `__all__` handling so other surface
   * checks do not report the same mutation as an unrelated dynamic construct.
   */
  private scanAll(statement: EvidNode): boolean {
    if (statement.type !== "expression_statement") return false;
    const expression = statement.namedChildren[0];
    if (expression?.type === "assignment") {
      if (EvidPythonSyntax.assignmentName(expression) !== "__all__")
        return false;
      const names = EvidPythonSyntax.literalSequence(
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
      if (EvidPythonSyntax.assignmentName(expression) !== "__all__")
        return false;
      const names = EvidPythonSyntax.literalSequence(
        expression.childForFieldName("right"),
      );
      if (this.all.state !== "static" || names === undefined)
        this.dynamicAll(expression);
      else this.all.names.push(...names);
      return true;
    }
    return false;
  }

  /**
   * Records bindings introduced by one supported module-scope import.
   *
   * Returns whether the statement was an import so declaration scanning can
   * continue without treating it as an unsupported surface expression.
   */
  private scanImport(statement: EvidNode): boolean {
    if (statement.type === "import_statement") {
      statement.namedChildren.forEach((entry, index) => {
        if (entry.type === "aliased_import") {
          const imported = entry.childForFieldName("name")?.text;
          const local = EvidPythonSyntax.name(entry.childForFieldName("alias"));
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
        const local = EvidPythonSyntax.name(entry.childForFieldName("alias"));
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

  /**
   * Extracts a class declaration and its supported class-level members.
   *
   * Nested traversal carries the class identity so methods and fields receive
   * addresses relative to their owning public type.
   */
  private scanClass(
    wrapper: EvidNode,
    definition: EvidNode,
    parent?: IEvidPythonClassContext,
  ): void {
    const name = EvidPythonSyntax.name(definition.childForFieldName("name"));
    if (name === undefined || (parent !== undefined && this.private(name)))
      return;
    const root = parent?.root ?? this.rootToken(name, wrapper);
    const identity = [...(parent?.identity ?? []), name];
    const suffix = parent === undefined ? [] : [...parent.suffix, name];
    const body = definition.childForFieldName("body");
    const headerEnd = body?.startIndex ?? definition.endIndex;
    if (parent !== undefined) this.replaceClassBinding(parent.parentId, name);
    const record: IEvidPythonOwnedUnit = this.addUnit(
      wrapper,
      definition,
      "type",
      identity,
      root,
      suffix,
      parent?.parentId,
      this.text.range(wrapper.startIndex, headerEnd),
    );
    if (parent !== undefined)
      this.rememberClassBinding(parent.parentId, name, record.unit.id);
    if (parent === undefined) this.bindLocal(name, wrapper.startIndex, root);
    if (body === null) return;
    const context: IEvidPythonClassContext = {
      identity,
      suffix,
      root,
      parentId: record.unit.id,
    };
    for (const statement of body.namedChildren) {
      if (statement.type === "comment") continue;
      const child = EvidPythonSyntax.definition(statement);
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

  /**
   * Extracts a module-level function declaration.
   *
   * The wrapper supplies documentation attachment while the definition supplies
   * the semantic name and source content range.
   */
  private scanFunction(wrapper: EvidNode, definition: EvidNode): void {
    const name = EvidPythonSyntax.name(definition.childForFieldName("name"));
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

  /**
   * Extracts a method declared in a selected class.
   *
   * Class context distinguishes instance and supported static-style ownership
   * before the unit is added to the file-local collection.
   */
  private scanMethod(
    wrapper: EvidNode,
    definition: EvidNode,
    context: IEvidPythonClassContext,
  ): void {
    const name = EvidPythonSyntax.name(definition.childForFieldName("name"));
    if (name === undefined) return;
    if (name === "__init__") {
      this.removeUnitTrees(
        this.constructorUnits.get(context.parentId) ?? new Set<string>(),
      );
      this.constructorUnits.set(context.parentId, new Set<string>());
      this.scanInstanceFields(definition, context);
      return;
    }
    if (this.private(name)) return;
    const decorators = EvidPythonSyntax.decoratorNames(wrapper);
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
    // Python assigns the decorator result under the declared method name. Only
    // an accessor based on that same name extends its existing property; an
    // accessor copied from another binding replaces the declared name instead.
    const accessorExtension: boolean = decorators.some(
      (decorator: string): boolean =>
        decorator === `${name}.getter` ||
        decorator === `${name}.setter` ||
        decorator === `${name}.deleter`,
    );
    const ownership = direct ? [] : ["prototype"];
    const merges: boolean =
      accessorExtension ||
      this.source.physicalPath.toLowerCase().endsWith(".pyi");
    this.replaceClassBinding(
      context.parentId,
      name,
      merges ? (property ? "property" : "function") : undefined,
    );
    const record: IEvidPythonOwnedUnit = this.addUnit(
      wrapper,
      definition,
      property ? "property" : "function",
      [...context.identity, ...ownership, name],
      context.root,
      [...context.suffix, ...ownership, name],
      context.parentId,
      this.session.range(wrapper),
      accessorExtension,
    );
    this.rememberClassBinding(context.parentId, name, record.unit.id);
  }

  /**
   * Extracts a statically named module-level type alias.
   *
   * The alias is a public type declaration when it is not private by spelling.
   */
  private scanTypeAlias(
    wrapper: EvidNode,
    definition: EvidNode,
    context?: IEvidPythonClassContext,
  ): void {
    const name = EvidPythonSyntax.typeAliasName(definition);
    if (name === undefined || (context !== undefined && this.private(name)))
      return;
    const root = context?.root ?? this.rootToken(name, wrapper);
    if (context !== undefined) this.replaceClassBinding(context.parentId, name);
    const record: IEvidPythonOwnedUnit = this.addUnit(
      wrapper,
      definition,
      "type",
      [...(context?.identity ?? []), name],
      root,
      context === undefined ? [] : [...context.suffix, name],
      context?.parentId,
      this.session.range(wrapper),
    );
    if (context !== undefined)
      this.rememberClassBinding(context.parentId, name, record.unit.id);
    if (context === undefined) this.bindLocal(name, wrapper.startIndex, root);
  }

  /**
   * Classifies a module-scope expression that may alter public declarations.
   *
   * Supported assignment forms are delegated; unrecognized surface mutations
   * become diagnostics to preserve inventory completeness.
   */
  private scanModuleExpression(statement: EvidNode): void {
    const expression = statement.namedChildren[0];
    if (expression?.type === "assignment")
      this.scanAssignments(statement, expression);
    else if (expression?.type === "augmented_assignment")
      this.scanAugmentedAssignment(statement, expression);
  }

  /**
   * Classifies a class-body expression that may define a member.
   *
   * Assignment handling receives the class context needed to publish member
   * addresses and reject unsupported receiver mutation.
   */
  private scanClassExpression(
    statement: EvidNode,
    context: IEvidPythonClassContext,
  ): void {
    const expression = statement.namedChildren[0];
    if (expression?.type === "assignment")
      this.scanAssignments(statement, expression, context);
    else if (expression?.type === "augmented_assignment")
      this.scanAugmentedAssignment(statement, expression, context);
  }

  /**
   * Records an augmented assignment as a property update.
   *
   * A same-kind class property keeps its earlier declaration sites. When the
   * update reuses a name previously occupied by another supported kind, the
   * class dictionary replacement removes that obsolete unit before the property
   * is added.
   */
  private scanAugmentedAssignment(
    statement: EvidNode,
    assignment: EvidNode,
    context?: IEvidPythonClassContext,
  ): void {
    const name = EvidPythonSyntax.assignmentName(assignment);
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
    if (context === undefined) this.replaceRootBinding(root, "property");
    else this.replaceClassBinding(context.parentId, name, "property");
    const record: IEvidPythonOwnedUnit = this.addUnit(
      statement,
      assignment,
      "property",
      [...(context?.identity ?? []), name],
      root,
      context === undefined ? [] : [...context.suffix, name],
      context?.parentId,
      this.session.range(assignment),
      true,
    );
    if (context !== undefined)
      this.rememberClassBinding(context.parentId, name, record.unit.id);
    if (context === undefined) this.bindLocal(name, statement.startIndex, root);
  }

  /**
   * Extracts supported simple assignments as module or class declarations.
   *
   * The surrounding context determines whether the assigned name is a type,
   * class property, or an unsupported dynamic surface change.
   */
  private scanAssignments(
    statement: EvidNode,
    assignment: EvidNode,
    context?: IEvidPythonClassContext,
  ): void {
    let current: EvidNode | null = assignment;
    let unsupported = false;
    while (current?.type === "assignment") {
      const left = current.childForFieldName("left");
      const name = EvidPythonSyntax.assignmentName(current);
      if (name !== undefined) {
        if (context === undefined || !this.private(name)) {
          const root = context?.root ?? this.rootToken(name, current);
          const symbol: EvidProgrammingSymbol =
            EvidPythonSyntax.typeAliasAnnotation(current) ? "type" : "property";
          if (context !== undefined)
            this.replaceClassBinding(context.parentId, name);
          const record: IEvidPythonOwnedUnit = this.addUnit(
            statement,
            current,
            symbol,
            [...(context?.identity ?? []), name],
            root,
            context === undefined ? [] : [...context.suffix, name],
            context?.parentId,
            this.session.range(current),
          );
          if (context !== undefined)
            this.rememberClassBinding(context.parentId, name, record.unit.id);
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

  /**
   * Extracts supported instance-field assignments from an initializer body.
   *
   * Only statically recognizable receiver attributes become property units.
   */
  private scanInstanceFields(
    definition: EvidNode,
    context: IEvidPythonClassContext,
  ): void {
    const receiver = EvidPythonSyntax.parameterName(definition);
    const body = definition.childForFieldName("body");
    if (receiver === undefined || body === null) return;
    for (const statement of body.namedChildren) {
      if (statement.type === "comment") continue;
      if (statement.type === "expression_statement") {
        let assignment: EvidNode | null = statement.namedChildren[0] ?? null;
        while (assignment?.type === "assignment") {
          const left = assignment.childForFieldName("left");
          const name =
            left !== null && EvidPythonSyntax.attributeObject(left) === receiver
              ? EvidPythonSyntax.attributeName(left)
              : undefined;
          if (name !== undefined && !this.private(name)) {
            const record: IEvidPythonOwnedUnit = this.addUnit(
              statement,
              assignment,
              "property",
              [...context.identity, "prototype", name],
              context.root,
              [...context.suffix, "prototype", name],
              context.parentId,
              this.session.range(assignment),
            );
            this.rememberConstructorUnit(context.parentId, record.unit.id);
          } else if (this.receiverAttributes(left, receiver).length !== 0)
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

  /**
   * Associates one generated field with its class's effective constructor.
   *
   * Initializing the owner defensively keeps field extraction self-contained if
   * another supported constructor spelling reaches it in a future grammar.
   */
  private rememberConstructorUnit(parentId: string, unitId: string): void {
    let units: Set<string> | undefined = this.constructorUnits.get(parentId);
    if (units === undefined) {
      units = new Set<string>();
      this.constructorUnits.set(parentId, units);
    }
    units.add(unitId);
  }

  /**
   * Adds the effective declaration site for one semantic unit.
   *
   * Runtime occurrences receive distinct IDs and replace the previous record so
   * their documentation cannot survive a rebinding. Explicit property families
   * and function overloads in stub files merge their physical sites.
   */
  private addUnit(
    wrapper: EvidNode,
    definition: EvidNode,
    symbol: EvidProgrammingSymbol,
    identity: string[],
    root: string,
    suffix: string[],
    parentId: string | undefined,
    content: IEvidSourceRange,
    mergeSites: boolean = false,
  ): IEvidPythonOwnedUnit {
    const semanticId: string = `python:${this.source.id}:${symbol}:${JSON.stringify(identity)}`;
    const merges: boolean =
      mergeSites ||
      (symbol === "function" &&
        this.source.physicalPath.toLowerCase().endsWith(".pyi"));
    const id: string = merges
      ? semanticId
      : `${semanticId}:binding:${String(wrapper.startIndex)}`;
    const siteId: string = this.siteId(wrapper);
    const site: IEvidUnitSite = {
      id: siteId,
      file: this.source.physicalPath,
      range: this.session.range(wrapper),
      content: [content],
    };
    let record: IEvidPythonOwnedUnit | undefined = this.units.get(semanticId);
    if (record === undefined || !merges) {
      const unit: IEvidUnit = {
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
      this.units.set(semanticId, record);
    } else {
      if (!record.roots.includes(root)) record.roots.push(root);
      const previous = record.unit.sites.find(
        (candidate) => candidate.id === site.id,
      );
      if (previous === undefined) record.unit.sites.push(site);
      else previous.content.push(content);
    }
    const unitId: string = record.unit.id;
    this.registerPosition(wrapper, siteId, unitId);
    this.attachPrecedingComment(wrapper, siteId, unitId);
    this.attachDocstring(definition, siteId, unitId);
    return record;
  }

  /**
   * Removes the class binding displaced by one later suite statement.
   *
   * Python stores methods, attributes, aliases, and nested classes in the same
   * executed class dictionary. Unless the new declaration extends an
   * established overload or accessor family, replacing a binding also removes
   * every unit structurally owned by the obsolete nested declaration.
   */
  private replaceClassBinding(
    parentId: string,
    name: string,
    mergeSymbol?: EvidProgrammingSymbol,
  ): void {
    const previous: string | undefined = this.classBindings.get(
      this.classBindingKey(parentId, name),
    );
    if (previous === undefined) return;
    if (
      mergeSymbol !== undefined &&
      Array.from(this.units.values()).some(
        (record: IEvidPythonOwnedUnit): boolean =>
          record.unit.id === previous && record.unit.symbol === mergeSymbol,
      )
    )
      return;
    this.removeUnitTrees([previous]);
  }

  /**
   * Removes top-level declaration kinds displaced at one retained local root.
   *
   * Augmented assignment reuses the current binding token because it reads and
   * updates that value. A property update can extend an earlier property, while
   * a function, type, or class at the same root no longer describes the final
   * public value and takes its structurally owned descendants with it.
   */
  private replaceRootBinding(
    root: string,
    mergeSymbol: EvidProgrammingSymbol,
  ): void {
    const removed: string[] = Array.from(this.units.values())
      .filter(
        (record: IEvidPythonOwnedUnit): boolean =>
          record.suffix.length === 0 &&
          record.roots.includes(root) &&
          record.unit.symbol !== mergeSymbol,
      )
      .map((record: IEvidPythonOwnedUnit): string => record.unit.id);
    this.removeUnitTrees(removed);
  }

  /**
   * Deletes selected units, their descendants, and stale class-slot ownership.
   *
   * Unit IDs are occurrence-specific for runtime declarations, so walking
   * `parentId` removes exactly the obsolete declaration tree without disturbing
   * a later declaration that reuses the same semantic name.
   */
  private removeUnitTrees(unitIds: Iterable<string>): void {
    const removed: Set<string> = new Set<string>(unitIds);
    let changed: boolean = true;
    while (changed) {
      changed = false;
      const records: IterableIterator<IEvidPythonOwnedUnit> =
        this.units.values();
      for (const record of records)
        if (
          record.unit.parentId !== undefined &&
          removed.has(record.unit.parentId) &&
          !removed.has(record.unit.id)
        ) {
          removed.add(record.unit.id);
          changed = true;
        }
    }
    const unitEntries: IterableIterator<[string, IEvidPythonOwnedUnit]> =
      this.units.entries();
    for (const [key, record] of unitEntries)
      if (removed.has(record.unit.id)) this.units.delete(key);
    const classEntries: IterableIterator<[string, string]> =
      this.classBindings.entries();
    for (const [key, unitId] of classEntries)
      if (removed.has(unitId)) this.classBindings.delete(key);
    const constructorEntries: IterableIterator<[string, Set<string>]> =
      this.constructorUnits.entries();
    for (const [parentId, unitIds] of constructorEntries) {
      if (removed.has(parentId)) {
        this.constructorUnits.delete(parentId);
        continue;
      }
      for (const unitId of unitIds)
        if (removed.has(unitId)) unitIds.delete(unitId);
    }
  }

  /**
   * Records the unit currently occupying one executed class binding.
   *
   * The owner uses an occurrence-specific unit ID, preventing a replacement
   * class from sharing binding state with an obsolete class of the same name.
   */
  private rememberClassBinding(
    parentId: string,
    name: string,
    unitId: string,
  ): void {
    this.classBindings.set(this.classBindingKey(parentId, name), unitId);
  }

  /**
   * Creates the collision key for one Python class dictionary entry.
   *
   * Runtime ownership, rather than the Evid symbol or projected `prototype`
   * segment, determines whether two declarations replace the same value.
   */
  private classBindingKey(parentId: string, name: string): string {
    return JSON.stringify([parentId, name]);
  }

  /**
   * Records a declaration position for later host selection.
   *
   * Positions retain parser-independent nesting and source-location metadata.
   */
  private registerPosition(
    node: EvidNode,
    siteId: string,
    unitId: string,
  ): void {
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

  /**
   * Attaches the immediately preceding standalone comment run to a declaration.
   *
   * Blank lines and intervening source prevent attachment so unrelated comments
   * cannot become evidence documentation.
   */
  private attachPrecedingComment(
    node: EvidNode,
    siteId: string,
    unitId: string,
  ): void {
    const documentation = this.commentDocumentation.get(node.startPosition.row);
    if (
      documentation === undefined ||
      documentation.range.start.column !== node.startPosition.column + 1 ||
      !this.standaloneComment(documentation.range.start.offset)
    )
      return;
    if (
      !/^[ \t]*\r?\n[ \t]*$/u.test(
        this.source.content.slice(
          documentation.range.end.offset,
          node.startIndex,
        ),
      )
    )
      return;
    this.attach(documentation, this.positionId(node), siteId, unitId);
  }

  /**
   * Attaches a recognized docstring mapping to a declaration site.
   *
   * The method records both declaration and site identities for later assembly.
   */
  private attachDocstring(
    definition: EvidNode,
    siteId: string,
    unitId: string,
  ): void {
    const value = EvidPythonSyntax.docstring(
      definition.childForFieldName("body"),
    );
    if (value === undefined) return;
    const parts = EvidPythonSyntax.docstringParts(value);
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

  /**
   * Adds one declaration-site attachment without duplicating the relation.
   *
   * Multiple traversal paths can reach a shared documentation mapping.
   */
  private attach(
    documentation: IEvidPythonDocumentation,
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

  /**
   * Collects contiguous Python comment runs eligible for declaration
   * attachment.
   *
   * The final line index allows a constant-time lookup from the next
   * declaration.
   */
  private collectCommentRuns(): void {
    const comments = this.session.root
      .descendantsOfType("comment")
      .sort((left, right) => left.startIndex - right.startIndex);
    for (let index = 0; index < comments.length; ++index) {
      const first = comments[index];
      if (first === undefined) continue;
      let last = first;
      while (
        this.standaloneComment(first.startIndex) &&
        index + 1 < comments.length
      ) {
        const next = comments[index + 1];
        if (
          next === undefined ||
          next.startPosition.column !== first.startPosition.column ||
          !/^[ \t]*\r?\n[ \t]*$/u.test(
            this.source.content.slice(last.endIndex, next.startIndex),
          )
        )
          break;
        last = next;
        ++index;
      }
      const range = this.text.range(first.startIndex, last.endIndex);
      const documentation = this.ensureDocumentationRange(
        range,
        EvidPythonSyntax.commentSyntax(),
      );
      this.commentDocumentation.set(range.end.line, documentation);
    }
  }

  /**
   * Checks whether a comment begins on an otherwise empty source line.
   *
   * Inline comments cannot document the following declaration.
   */
  private standaloneComment(offset: number): boolean {
    const start = this.source.content.lastIndexOf("\n", offset - 1) + 1;
    return /^[ \t]*$/u.test(this.source.content.slice(start, offset));
  }

  /**
   * Finds string literals that carry Evid annotation tags.
   *
   * Tagged literals are retained even when they are not attachable docstrings.
   */
  private collectStringAnnotations(): void {
    for (const string of this.session.root.descendantsOfType("string")) {
      if (this.docstringParts.has(this.nodeKey(string))) continue;
      const syntax = EvidPythonSyntax.stringSyntax(string);
      if (syntax === undefined) continue;
      const raw = this.source.content.slice(
        string.startIndex + syntax.opening.length,
        string.endIndex - syntax.closing.length,
      );
      if (this.annotation(raw)) this.ensureDocumentation(string, syntax);
    }
  }

  /**
   * Creates or returns documentation for one string literal range.
   *
   * Mapping identity is derived from the stable source range.
   */
  private ensureStringDocumentation(
    node: EvidNode,
  ): IEvidPythonDocumentation | undefined {
    const syntax = EvidPythonSyntax.stringSyntax(node);
    return syntax === undefined
      ? undefined
      : this.ensureDocumentation(node, syntax);
  }

  /**
   * Creates documentation for adjacent string literals forming one docstring.
   *
   * Consumed parts are remembered to avoid overlapping documentation mappings.
   */
  private ensureConcatenatedDocumentation(
    node: EvidNode,
    parts: EvidNode[],
  ): IEvidPythonDocumentation {
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
      const syntax = EvidPythonSyntax.stringSyntax(part);
      if (syntax === undefined) continue;
      const mapped = EvidDocumentation.read(
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

  /**
   * Returns the documentation carrier for a stable extraction identity.
   *
   * The first caller supplies mapping metadata; later callers reuse it.
   */
  private ensureDocumentation(
    node: EvidNode,
    syntax: IEvidCommentSyntax,
  ): IEvidPythonDocumentation {
    return this.ensureDocumentationRange(this.session.range(node), syntax);
  }

  /**
   * Returns documentation keyed by an exact source range.
   *
   * Range identity lets comments and string annotations coexist in one map.
   */
  private ensureDocumentationRange(
    range: IEvidSourceRange,
    syntax: IEvidCommentSyntax,
  ): IEvidPythonDocumentation {
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

  /**
   * Records a local binding with its source-order precedence.
   *
   * Export resolution uses the latest binding to model Python shadowing.
   */
  private bindLocal(name: string, order: number, root: string): void {
    this.bindings.push({ kind: "local", localName: name, order, root });
  }

  /**
   * Finds the currently winning local root for a module name.
   *
   * This mirrors the same ordered binding rule used by export resolution.
   */
  private currentLocalRoot(name: string): string | undefined {
    return this.bindings.findLast(
      (binding) => binding.kind === "local" && binding.localName === name,
    )?.root;
  }

  /**
   * Creates a stable local-root token from a name and parser position.
   *
   * Distinct rebindings need distinct roots even when they share a name.
   */
  private rootToken(name: string, node: EvidNode): string {
    return `${name}:${node.startIndex}`;
  }

  /**
   * Reports an `__all__` mutation that cannot be statically enumerated.
   *
   * Public names remain incomplete rather than being guessed from runtime code.
   */
  private dynamicAll(node: EvidNode): void {
    this.all.state = "dynamic";
    this.problem(
      "python-dynamic-all",
      "The module mutates __all__ with a form that cannot be resolved statically.",
      "Use a literal string list or tuple, literal '+' composition, and top-level '+=' additions.",
      node,
    );
  }

  /**
   * Detects nested mutations of the module's `__all__` binding.
   *
   * Control flow around this state prevents a complete static export
   * population.
   */
  private containsAllMutation(node: EvidNode): boolean {
    const definition = EvidPythonSyntax.definition(node);
    if (
      definition.type === "function_definition" ||
      definition.type === "class_definition"
    )
      return false;
    if (
      (node.type === "assignment" || node.type === "augmented_assignment") &&
      EvidPythonSyntax.assignmentName(node) === "__all__"
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
        EvidPythonSyntax.attributeObject(callable) === "__all__"
      )
        return true;
    }
    return node.namedChildren.some((child) => this.containsAllMutation(child));
  }

  /**
   * Detects nested constructs that conditionally alter module public surface.
   *
   * The scanner reports these boundaries instead of following executable flow.
   */
  private containsModuleSurface(node: EvidNode): boolean {
    const queue: EvidNode[] = [node];
    for (let index = 0; index < queue.length; ++index) {
      const child = queue[index];
      if (child === undefined) continue;
      const definition = EvidPythonSyntax.definition(child);
      if (
        definition.type === "class_definition" ||
        definition.type === "function_definition"
      ) {
        if (
          this.selectedModuleName(
            EvidPythonSyntax.name(definition.childForFieldName("name")),
          )
        )
          return true;
        continue;
      }
      if (
        definition.type === "type_alias_statement" &&
        this.selectedModuleName(EvidPythonSyntax.typeAliasName(definition))
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
        this.selectedModuleName(EvidPythonSyntax.assignmentName(child))
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

  /**
   * Detects class-body constructs that dynamically alter member surface.
   *
   * Dynamic class execution cannot safely become selected declarations.
   */
  private containsClassSurface(node: EvidNode): boolean {
    const queue: EvidNode[] = [node];
    for (let index = 0; index < queue.length; ++index) {
      const child = queue[index];
      if (child === undefined) continue;
      const definition = EvidPythonSyntax.definition(child);
      const declarationName =
        definition.type === "type_alias_statement"
          ? EvidPythonSyntax.typeAliasName(definition)
          : EvidPythonSyntax.name(definition.childForFieldName("name"));
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

  /**
   * Checks whether a module name is eligible for public extraction.
   *
   * Private spellings are excluded unless `__all__` later explicitly exposes
   * them.
   */
  private selectedModuleName(name: string | undefined): boolean {
    if (name === undefined) return false;
    return this.all.state === "static"
      ? this.all.names.includes(name)
      : !this.private(name) || this.all.names.includes(name);
  }

  /**
   * Checks whether a conditional import would introduce a selected public name.
   *
   * Such imports make the exported surface depend on runtime control flow.
   */
  private conditionalImportSelected(statement: EvidNode): boolean {
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
          ? EvidPythonSyntax.name(entry.childForFieldName("alias"))
          : entry.type === "dotted_name"
            ? entry.text.split(".")[0]
            : undefined;
      if (this.selectedModuleName(local)) return true;
    }
    return false;
  }

  /**
   * Detects assignments through a receiver that can create instance fields.
   *
   * Receiver-aware scanning distinguishes supported initializer fields from
   * arbitrary mutation in nested executable code.
   */
  private containsReceiverAssignment(
    node: EvidNode,
    receiver: string,
  ): boolean {
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

  /**
   * Returns literal attribute names assigned through one receiver expression.
   *
   * Only these names can be represented as static property declarations.
   */
  private receiverAttributes(
    node: EvidNode | null,
    receiver: string,
  ): string[] {
    if (node === null) return [];
    const attributes =
      node.type === "attribute" ? [node] : node.descendantsOfType("attribute");
    return attributes.flatMap((attribute) => {
      const name = EvidPythonSyntax.attributeName(attribute);
      return EvidPythonSyntax.attributeObject(attribute) === receiver &&
        name !== undefined &&
        !this.private(name)
        ? [name]
        : [];
    });
  }

  /**
   * Returns non-private identifiers from a syntax subtree.
   *
   * The helper centralizes Python underscore filtering for surface predicates.
   */
  private publicIdentifiers(node: EvidNode | null): string[] {
    return this.identifiers(node).filter((name) => !this.private(name));
  }

  /**
   * Checks whether an assignment introduces a selected public identifier.
   *
   * The caller uses this to decide whether dynamic control flow is reportable.
   */
  private selectedAssignment(
    node: EvidNode | null,
    context: IEvidPythonClassContext | undefined,
  ): boolean {
    const names = this.identifiers(node);
    return context === undefined
      ? names.some((name) => this.selectedModuleName(name))
      : names.some((name) => !this.private(name));
  }

  /**
   * Extracts literal identifier spellings from a parser subtree.
   *
   * Unnamed or computed targets are intentionally absent from this static view.
   */
  private identifiers(node: EvidNode | null): string[] {
    if (node === null) return [];
    const identifiers =
      node.type === "identifier"
        ? [node]
        : node.descendantsOfType("identifier");
    return identifiers.map((identifier) => identifier.text);
  }

  /**
   * Checks Python's conventional underscore-based private spelling.
   *
   * `__all__` remains the explicit mechanism for exposing such a binding.
   */
  private private(name: string): boolean {
    return name.startsWith("_");
  }

  /**
   * Checks whether raw comment or string text contains an Evid tag.
   *
   * Tagged carriers are retained even when ordinary documentation attachment
   * fails.
   */
  private annotation(raw: string): boolean {
    return /(?:^|[\r\n])[ \t]*(?:#[ \t]*)?@(evidenceExcludeReview|evidenceReview|evidenceExclude|evidence|link|internal|hidden|ignore)\b/u.test(
      raw,
    );
  }

  /**
   * Serializes a parser node's source range as a local identity component.
   *
   * Offsets remain stable for the immutable source snapshot.
   */
  private nodeKey(node: EvidNode): string {
    return `${node.startIndex}:${node.endIndex}`;
  }

  /**
   * Creates the stable declaration-site identity for a parser node.
   *
   * The source ID scopes otherwise reusable range offsets.
   */
  private siteId(node: EvidNode): string {
    return `python:${this.source.id}:site:${this.nodeKey(node)}`;
  }

  /**
   * Creates the stable host-position identity for a parser node.
   *
   * Position records use a distinct namespace from declaration sites.
   */
  private positionId(node: EvidNode): string {
    return `python:${this.source.id}:position:${this.nodeKey(node)}`;
  }

  /**
   * Records one unsupported source construct and marks scanning incomplete.
   *
   * A source-range key prevents duplicate diagnostics from overlapping checks.
   */
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
