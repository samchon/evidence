import type { Node } from "web-tree-sitter";

import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";
import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { EcmaScriptModuleMode } from "./EcmaScriptModuleMode";
import type { EcmaScriptType } from "./EcmaScriptType";
import type { IEcmaScriptComment } from "./IEcmaScriptComment";
import type { IEcmaScriptExport } from "./IEcmaScriptExport";
import type { IEcmaScriptFileAnalysis } from "./IEcmaScriptFileAnalysis";
import type { IEcmaScriptHostPosition } from "./IEcmaScriptHostPosition";
import type { IEcmaScriptImport } from "./IEcmaScriptImport";
import type { IEcmaScriptOwnedUnit } from "./IEcmaScriptOwnedUnit";
import type { IEcmaScriptStatementContext } from "./IEcmaScriptStatementContext";
import { EcmaScriptSyntax } from "./EcmaScriptSyntax";

/**
 * Extracts local ECMAScript-family declarations before exports assign addresses.
 *
 * It captures declared ownership, comment attachment, and static module edges;
 * `EcmaScriptExportResolver` alone decides which local units become public.
 */
export class EcmaScriptFileScanner {
  private readonly units = new Map<string, IEcmaScriptOwnedUnit>();
  private readonly excludedRoots = new Set<string>();
  private readonly comments = new Map<string, IEcmaScriptComment>();
  private readonly exports: IEcmaScriptExport[] = [];
  private readonly positions = new Map<string, IEcmaScriptHostPosition>();
  private readonly imports: IEcmaScriptImport[] = [];
  private readonly diagnostics: IEvidenceDiagnostic[] = [];
  private readonly commonJsExports = new Map<string, IEcmaScriptExport>();
  private commonJsAliasAttached = true;
  private commonJsStaticObject = true;
  private complete = true;

  /**
   * Creates a scanner for one parsed module and its already-selected semantics.
   *
   * Comment ranges are captured while parser nodes are live, then the resulting
   * analysis can outlast the parse session without retaining native nodes.
   */
  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
    private readonly type: EcmaScriptType,
    private readonly mode: EcmaScriptModuleMode,
  ) {
    for (const node of session.root.descendantsOfType("comment")) {
      const range = session.range(node);
      this.comments.set(this.commentKey(node), {
        id: `${type}:${source.id}:comment:${range.start.offset}`,
        range,
        syntax: EcmaScriptSyntax.comment(node),
        attachments: [],
      });
    }
  }

  /**
   * Scans declarations, static imports, and export edges into one module record.
   *
   * Unsupported dynamic or malformed public-surface constructs retain diagnostics
   * and incompleteness instead of disappearing from downstream coverage.
   */
  public scan(): IEcmaScriptFileAnalysis {
    if (this.mode === "esm") this.collectImports();
    this.scanStatements(this.session.root, {
      semanticPrefix: [],
      publicPrefix: [],
      ambient: this.type === "typescript" && this.declarationFile(),
      visible: true,
      typeOnly: false,
    });
    if (this.mode === "commonjs") this.scanCommonJs();
    return {
      source: this.source,
      mode: this.mode,
      units: Array.from(this.units.values()),
      excludedRoots: Array.from(this.excludedRoots),
      exports: this.exports,
      imports: this.imports,
      positions: Array.from(this.positions.values()),
      comments: Array.from(this.comments.values()),
      diagnostics: this.diagnostics,
      complete: this.complete,
    };
  }

  private collectImports(): void {
    for (const statement of this.session.root.namedChildren) {
      if (statement.type !== "import_statement") continue;
      const specifier = EcmaScriptSyntax.module(
        statement.childForFieldName("source"),
      );
      if (specifier === undefined) {
        this.problem(
          `${this.type}-import`,
          `A ${this.language()} import has no static string module specifier.`,
          "Use a string-literal module specifier before re-exporting its bindings.",
          statement,
        );
        continue;
      }
      const clause = statement.namedChildren.find(
        (child) => child.type === "import_clause",
      );
      if (clause === undefined) continue;
      const statementTypeOnly = EcmaScriptSyntax.token(statement, "type");
      const direct = clause.namedChildren.find(
        (child) => child.type === "identifier",
      );
      if (direct !== undefined)
        this.imports.push({
          localName: direct.text,
          importedName: "default",
          specifier,
          typeOnly: statementTypeOnly,
          namespace: false,
        });
      const namespace = clause.namedChildren.find(
        (child) => child.type === "namespace_import",
      );
      const namespaceName =
        namespace === undefined
          ? undefined
          : namespace.namedChildren.find(
              (child) => child.type === "identifier",
            );
      if (namespaceName !== undefined)
        this.imports.push({
          localName: namespaceName.text,
          specifier,
          typeOnly: statementTypeOnly,
          namespace: true,
        });
      const named = clause.namedChildren.find(
        (child) => child.type === "named_imports",
      );
      for (const entry of named?.namedChildren ?? []) {
        if (entry.type !== "import_specifier") continue;
        const imported = EcmaScriptSyntax.specifierName(entry);
        const local = EcmaScriptSyntax.specifierAlias(entry) ?? imported;
        if (imported === undefined || local === undefined) continue;
        this.imports.push({
          localName: local,
          importedName: imported,
          specifier,
          typeOnly: statementTypeOnly || EcmaScriptSyntax.token(entry, "type"),
          namespace: false,
        });
      }
    }
  }

  private scanStatements(
    block: Node,
    inherited: IEcmaScriptStatementContext,
  ): void {
    const declarations = block.namedChildren.filter(
      (child) => child.type !== "comment",
    );
    const functionNames = new Set<string>();
    const classNames = new Set<string>();
    for (const statement of declarations) {
      const declaration = this.declaration(statement);
      const name = EcmaScriptSyntax.qualifiedName(
        declaration.childForFieldName("name"),
      )[0];
      if (name === undefined) continue;
      if (
        declaration.type === "function_declaration" ||
        declaration.type === "generator_function_declaration" ||
        declaration.type === "function_signature"
      )
        functionNames.add(name);
      else if (
        declaration.type === "class_declaration" ||
        declaration.type === "abstract_class_declaration"
      )
        classNames.add(name);
    }
    for (const statement of declarations) {
      if (
        this.mode === "commonjs" &&
        (statement.type === "import_statement" ||
          statement.type === "export_statement")
      ) {
        this.problem(
          "javascript-module-syntax",
          "ECMAScript module syntax appears in a CommonJS source file.",
          "Use a .mjs file or set the nearest package.json type to 'module'.",
          statement,
        );
        continue;
      }
      if (statement.type === "import_statement") continue;
      if (
        statement.type === "export_statement" &&
        statement.childForFieldName("declaration") === null &&
        !this.exportedDeclaration(statement.childForFieldName("value"))
      ) {
        this.scanExport(statement, inherited);
        continue;
      }
      const wrapper = statement;
      const declaration = this.declaration(statement);
      const exported =
        inherited.ambient ||
        (statement.type === "export_statement" &&
          statement.childForFieldName("source") === null);
      const visible =
        inherited.semanticPrefix.length === 0
          ? true
          : inherited.visible && exported;
      const context: IEcmaScriptStatementContext = {
        ...inherited,
        ambient:
          this.type === "typescript" &&
          (inherited.ambient ||
            statement.type === "ambient_declaration" ||
            statement.namedChildren.some(
              (child) => child.type === "ambient_declaration",
            )),
        visible,
        typeOnly:
          inherited.typeOnly ||
          (statement.type === "export_statement" &&
            EcmaScriptSyntax.token(statement, "type")),
      };
      this.scanDeclaration(
        wrapper,
        declaration,
        context,
        functionNames,
        classNames,
      );
    }
  }

  private scanDeclaration(
    wrapper: Node,
    declaration: Node,
    context: IEcmaScriptStatementContext,
    functionNames: Set<string>,
    classNames: Set<string>,
  ): void {
    switch (declaration.type) {
      case "interface_declaration":
        this.scanInterface(wrapper, declaration, context, classNames);
        break;
      case "type_alias_declaration":
        this.scanTypeAlias(wrapper, declaration, context);
        break;
      case "class_declaration":
      case "abstract_class_declaration":
      case "class":
        this.scanClass(wrapper, declaration, context);
        break;
      case "function_declaration":
      case "function_expression":
      case "function_signature":
      case "generator_function":
      case "generator_function_declaration":
        this.scanFunction(wrapper, declaration, context);
        break;
      case "lexical_declaration":
      case "variable_declaration":
        this.scanVariables(wrapper, declaration, context);
        break;
      case "internal_module":
        this.scanNamespace(wrapper, declaration, context, functionNames);
        break;
      case "enum_declaration":
        this.scanExcludedRoot(wrapper, declaration, context);
        break;
      case "module":
        this.problem(
          "typescript-ambient-module",
          "An ambient module declaration requires unsupported package-resolution semantics.",
          "Move the contract behind relative ECMAScript exports or add ambient-module resolution to this adapter.",
          declaration,
        );
        break;
      case "ambient_declaration":
        this.problem(
          "typescript-ambient-global",
          "A global augmentation has no file-qualified module address.",
          "Move the contract behind ECMAScript exports or add global-augmentation resolution to this adapter.",
          declaration,
        );
        break;
      default:
        break;
    }
  }

  private scanInterface(
    wrapper: Node,
    declaration: Node,
    context: IEcmaScriptStatementContext,
    classNames: Set<string>,
  ): void {
    const local = EcmaScriptSyntax.name(declaration.childForFieldName("name"));
    if (local === undefined || !context.visible) return;
    const defaulted =
      wrapper.type === "export_statement" &&
      EcmaScriptSyntax.token(wrapper, "default");
    const identity = [...context.semanticPrefix, local];
    const root = context.root ?? local;
    const suffix =
      context.root === undefined ? [] : [...context.publicPrefix, local];
    const type = this.addUnit(
      wrapper,
      declaration,
      "type",
      identity,
      root,
      suffix,
      context.parentId,
      true,
      false,
    );
    this.directExport(wrapper, local, context, defaulted);
    const mergedClass = classNames.has(local);
    const memberOwner = mergedClass ? [...identity, "prototype"] : identity;
    const memberPrefix = mergedClass ? [...suffix, "prototype"] : suffix;
    if (context.typeOnly && mergedClass) return;
    const body = declaration.childForFieldName("body");
    if (body !== null)
      this.scanTypeMembers(
        body,
        memberOwner,
        memberPrefix,
        root,
        type.unit.id,
        mergedClass,
      );
  }

  private scanExcludedRoot(
    wrapper: Node,
    declaration: Node,
    context: IEcmaScriptStatementContext,
  ): void {
    if (!context.visible) return;
    const local = EcmaScriptSyntax.name(declaration.childForFieldName("name"));
    if (local === undefined) return;
    this.excludedRoots.add(local);
    this.directExport(wrapper, local, context, false);
  }

  private scanTypeAlias(
    wrapper: Node,
    declaration: Node,
    context: IEcmaScriptStatementContext,
  ): void {
    const local = EcmaScriptSyntax.name(declaration.childForFieldName("name"));
    if (local === undefined || !context.visible) return;
    const identity = [...context.semanticPrefix, local];
    const root = context.root ?? local;
    const suffix =
      context.root === undefined ? [] : [...context.publicPrefix, local];
    const type = this.addUnit(
      wrapper,
      declaration,
      "type",
      identity,
      root,
      suffix,
      context.parentId,
      true,
      false,
    );
    this.directExport(wrapper, local, context, false);
    const value = declaration.childForFieldName("value");
    if (value?.type === "object_type")
      this.scanTypeMembers(value, identity, suffix, root, type.unit.id, false);
  }

  private scanClass(
    wrapper: Node,
    declaration: Node,
    context: IEcmaScriptStatementContext,
  ): void {
    const declared = EcmaScriptSyntax.name(
      declaration.childForFieldName("name"),
    );
    const defaulted =
      wrapper.type === "export_statement" &&
      EcmaScriptSyntax.token(wrapper, "default");
    const local =
      declared ?? (defaulted ? `default:${declaration.startIndex}` : undefined);
    if (local === undefined || !context.visible) return;
    const semanticName = declared ?? "default";
    const identity = [...context.semanticPrefix, semanticName];
    const root = context.root ?? local;
    const suffix =
      context.root === undefined ? [] : [...context.publicPrefix, semanticName];
    const type = this.addUnit(
      wrapper,
      declaration,
      "type",
      identity,
      root,
      suffix,
      context.parentId,
      true,
      true,
    );
    this.directExport(wrapper, local, context, defaulted);
    if (context.typeOnly) return;
    const body = declaration.childForFieldName("body");
    if (body !== null)
      this.scanClassMembers(body, identity, suffix, root, type.unit.id);
  }

  private scanFunction(
    wrapper: Node,
    declaration: Node,
    context: IEcmaScriptStatementContext,
  ): void {
    if (context.typeOnly || !context.visible) return;
    const declared = EcmaScriptSyntax.name(
      declaration.childForFieldName("name"),
    );
    const defaulted =
      wrapper.type === "export_statement" &&
      EcmaScriptSyntax.token(wrapper, "default");
    const local =
      declared ?? (defaulted ? `default:${declaration.startIndex}` : undefined);
    if (local === undefined) return;
    const semanticName = declared ?? "default";
    const identity = [...context.semanticPrefix, semanticName];
    const root = context.root ?? local;
    const suffix =
      context.root === undefined ? [] : [...context.publicPrefix, semanticName];
    this.addUnit(
      wrapper,
      declaration,
      "function",
      identity,
      root,
      suffix,
      context.parentId,
      false,
      true,
    );
    this.directExport(wrapper, local, context, defaulted);
  }

  private scanVariables(
    wrapper: Node,
    declaration: Node,
    context: IEcmaScriptStatementContext,
  ): void {
    if (context.typeOnly || !context.visible) return;
    const constant = EcmaScriptSyntax.token(declaration, "const");
    for (const declarator of declaration.namedChildren) {
      if (declarator.type !== "variable_declarator") continue;
      const bindingNode = declarator.childForFieldName("name");
      const value = declarator.childForFieldName("value");
      const callable =
        constant &&
        bindingNode?.type === "identifier" &&
        EcmaScriptSyntax.functionValue(value);
      const symbol: EvidenceProgrammingSymbol = callable
        ? "function"
        : "property";
      for (const binding of EcmaScriptSyntax.bindings(bindingNode)) {
        const local = EcmaScriptSyntax.name(binding);
        if (local === undefined) continue;
        const identity = [...context.semanticPrefix, local];
        const root = context.root ?? local;
        const suffix =
          context.root === undefined ? [] : [...context.publicPrefix, local];
        this.addUnit(
          wrapper,
          declarator,
          symbol,
          identity,
          root,
          suffix,
          context.parentId,
          false,
          true,
          declarator,
        );
        this.directExport(wrapper, local, context, false);
      }
    }
  }

  private scanNamespace(
    wrapper: Node,
    declaration: Node,
    context: IEcmaScriptStatementContext,
    functionNames: Set<string>,
  ): void {
    const nameNode = declaration.childForFieldName("name");
    if (nameNode?.type === "string") {
      this.problem(
        "typescript-ambient-module",
        "An ambient module declaration requires unsupported package-resolution semantics.",
        "Move the contract behind relative ECMAScript exports or add ambient-module resolution to this adapter.",
        declaration,
      );
      return;
    }
    const names = EcmaScriptSyntax.qualifiedName(nameNode);
    const local = names[0];
    if (local === undefined) {
      this.problem(
        "typescript-namespace-name",
        "A TypeScript namespace declaration has no file-qualified static name.",
        "Use an identifier namespace or add explicit support for this ambient declaration form.",
        declaration,
      );
      return;
    }
    if (!context.visible) return;
    const root = context.root ?? local;
    let identity = [...context.semanticPrefix];
    let suffix = [...context.publicPrefix];
    let parentId = context.parentId;
    for (const [index, name] of names.entries()) {
      identity = [...identity, name];
      if (context.root !== undefined || index !== 0) suffix = [...suffix, name];
      const type = this.addUnit(
        index === 0 ? wrapper : declaration,
        declaration,
        "type",
        identity,
        root,
        suffix,
        parentId,
        true,
        true,
        undefined,
        index === 0,
      );
      parentId = type.unit.id;
    }
    this.directExport(wrapper, local, context, false);
    if (functionNames.has(local)) return;
    const body = declaration.childForFieldName("body");
    if (body === null || parentId === undefined) return;
    this.scanStatements(body, {
      semanticPrefix: identity,
      publicPrefix: suffix,
      root,
      parentId,
      ambient:
        context.ambient || EcmaScriptSyntax.modifier(declaration, "declare"),
      visible: true,
      typeOnly: context.typeOnly,
    });
  }

  private scanTypeMembers(
    body: Node,
    owner: string[],
    publicPrefix: string[],
    root: string,
    parentId: string,
    valueSpace: boolean,
  ): void {
    for (const member of body.namedChildren) {
      if (member.type === "comment") continue;
      let symbol: EvidenceProgrammingSymbol;
      if (member.type === "method_signature") {
        if (
          EcmaScriptSyntax.token(member, "get") ||
          EcmaScriptSyntax.token(member, "set")
        )
          continue;
        symbol = "function";
      } else if (member.type === "property_signature")
        symbol = EcmaScriptSyntax.functionType(member.childForFieldName("type"))
          ? "function"
          : "property";
      else continue;
      const name = EcmaScriptSyntax.memberName(member);
      if (name === undefined) continue;
      this.addUnit(
        member,
        member,
        symbol,
        [...owner, name],
        root,
        [...publicPrefix, name],
        parentId,
        !valueSpace,
        valueSpace,
      );
    }
  }

  private scanClassMembers(
    body: Node,
    owner: string[],
    publicPrefix: string[],
    root: string,
    parentId: string,
  ): void {
    const constructors = body.namedChildren.filter((member) => {
      if (
        member.type !== "method_definition" &&
        member.type !== "method_signature"
      )
        return false;
      return (
        EcmaScriptSyntax.name(member.childForFieldName("name")) ===
        "constructor"
      );
    });
    for (const member of body.namedChildren) {
      if (member.type === "comment") continue;
      const name = EcmaScriptSyntax.memberName(member);
      if (name === undefined) continue;
      const method =
        member.type === "method_definition" ||
        member.type === "method_signature" ||
        member.type === "abstract_method_signature";
      if (method && name === "constructor") {
        if (member.type === "method_definition")
          this.scanParameterProperties(
            member,
            owner,
            publicPrefix,
            root,
            parentId,
            constructors,
          );
        continue;
      }
      if (!EcmaScriptSyntax.publicMember(member)) continue;
      if (method) {
        if (
          EcmaScriptSyntax.token(member, "get") ||
          EcmaScriptSyntax.token(member, "set")
        )
          continue;
        this.addClassMember(
          member,
          "function",
          name,
          owner,
          publicPrefix,
          root,
          parentId,
        );
      } else if (
        member.type === "public_field_definition" ||
        member.type === "field_definition"
      ) {
        const symbol: EvidenceProgrammingSymbol =
          EcmaScriptSyntax.functionValue(member.childForFieldName("value")) ||
          EcmaScriptSyntax.functionType(member.childForFieldName("type"))
            ? "function"
            : "property";
        this.addClassMember(
          member,
          symbol,
          name,
          owner,
          publicPrefix,
          root,
          parentId,
        );
      }
    }
  }

  private scanParameterProperties(
    constructor: Node,
    owner: string[],
    publicPrefix: string[],
    root: string,
    parentId: string,
    constructors: Node[],
  ): void {
    const parameters = constructor.childForFieldName("parameters");
    for (const parameter of parameters?.namedChildren ?? []) {
      if (
        parameter.type !== "required_parameter" &&
        parameter.type !== "optional_parameter"
      )
        continue;
      if (
        !parameter.namedChildren.some(
          (child) => child.type === "accessibility_modifier",
        ) &&
        !EcmaScriptSyntax.modifier(parameter, "readonly") &&
        !EcmaScriptSyntax.modifier(parameter, "override")
      )
        continue;
      if (!EcmaScriptSyntax.publicMember(parameter)) continue;
      const pattern = parameter.childForFieldName("pattern");
      const name = EcmaScriptSyntax.name(pattern);
      if (name === undefined) continue;
      const symbol: EvidenceProgrammingSymbol =
        EcmaScriptSyntax.functionValue(parameter.childForFieldName("value")) ||
        EcmaScriptSyntax.functionType(parameter.childForFieldName("type"))
          ? "function"
          : "property";
      const field = this.addUnit(
        parameter,
        parameter,
        symbol,
        [...owner, "prototype", name],
        root,
        [...publicPrefix, "prototype", name],
        parentId,
        false,
        true,
      );
      for (const declaration of constructors)
        this.attach(
          declaration,
          undefined,
          this.siteId(parameter),
          field.unit.id,
          true,
        );
    }
  }

  private addClassMember(
    member: Node,
    symbol: EvidenceProgrammingSymbol,
    name: string,
    owner: string[],
    publicPrefix: string[],
    root: string,
    parentId: string,
  ): void {
    const statically = EcmaScriptSyntax.modifier(member, "static");
    this.addUnit(
      member,
      member,
      symbol,
      statically ? [...owner, name] : [...owner, "prototype", name],
      root,
      statically
        ? [...publicPrefix, name]
        : [...publicPrefix, "prototype", name],
      parentId,
      false,
      true,
    );
  }

  private scanExport(
    statement: Node,
    context: IEcmaScriptStatementContext,
  ): void {
    if (context.semanticPrefix.length !== 0) {
      this.problem(
        "typescript-namespace-export",
        "A namespace export list is outside the current TypeScript adapter contract.",
        "Place export modifiers on the namespace members until local namespace aliases are supported.",
        statement,
      );
      return;
    }
    if (EcmaScriptSyntax.token(statement, "=")) {
      this.problem(
        "typescript-export-assignment",
        "A CommonJS export assignment has no stable ECMAScript export name.",
        "Replace 'export =' with named or default ECMAScript exports.",
        statement,
      );
      return;
    }
    if (
      EcmaScriptSyntax.token(statement, "as") &&
      EcmaScriptSyntax.token(statement, "namespace")
    ) {
      this.problem(
        "typescript-umd-export",
        "A UMD global namespace export is outside file-qualified module resolution.",
        "Use ECMAScript exports or add UMD global resolution to this adapter.",
        statement,
      );
      return;
    }
    const specifier = EcmaScriptSyntax.module(
      statement.childForFieldName("source"),
    );
    const typeOnly = EcmaScriptSyntax.token(statement, "type");
    const clause = statement.namedChildren.find(
      (child) => child.type === "export_clause",
    );
    const namespace = statement.namedChildren.find(
      (child) => child.type === "namespace_export",
    );
    if (namespace !== undefined && specifier !== undefined) {
      const publicName = EcmaScriptSyntax.name(
        namespace.namedChildren[0] ?? null,
      );
      if (publicName !== undefined)
        this.exports.push({
          kind: "namespace",
          publicName,
          specifier,
          typeOnly,
        });
      return;
    }
    if (clause !== undefined) {
      for (const child of clause.namedChildren) {
        if (child.type !== "export_specifier") continue;
        const local = EcmaScriptSyntax.specifierName(child);
        const publicName = EcmaScriptSyntax.specifierAlias(child) ?? local;
        if (local === undefined || publicName === undefined) continue;
        this.exports.push(
          specifier === undefined
            ? {
                kind: "local",
                publicName,
                localName: local,
                typeOnly: typeOnly || EcmaScriptSyntax.token(child, "type"),
              }
            : {
                kind: "named",
                publicName,
                importedName: local,
                specifier,
                typeOnly: typeOnly || EcmaScriptSyntax.token(child, "type"),
              },
        );
      }
      return;
    }
    if (specifier !== undefined)
      this.exports.push({ kind: "star", specifier, typeOnly });
    else if (statement.childForFieldName("value") !== null) {
      const value = statement.childForFieldName("value");
      const localName = EcmaScriptSyntax.name(value);
      if (localName !== undefined)
        this.exports.push({
          kind: "local",
          publicName: "default",
          localName,
          typeOnly: false,
        });
      else if (this.type === "javascript" && value !== null)
        this.scanJavaScriptDefault(statement, value);
      else
        this.problem(
          `${this.type}-default-export`,
          `A ${this.language()} default export expression has no statically resolvable local declaration.`,
          "Name the declaration or export a local identifier as default.",
          statement,
        );
    }
  }

  private scanJavaScriptDefault(statement: Node, value: Node): void {
    const localName = `default:${statement.startIndex}`;
    const symbol: EvidenceProgrammingSymbol = EcmaScriptSyntax.functionValue(
      value,
    )
      ? "function"
      : "property";
    this.addUnit(
      statement,
      value,
      symbol,
      ["default"],
      localName,
      [],
      undefined,
      false,
      true,
    );
    this.exports.push({
      kind: "local",
      publicName: "default",
      localName,
      typeOnly: false,
    });
  }

  private directExport(
    wrapper: Node,
    localName: string,
    context: IEcmaScriptStatementContext,
    defaulted: boolean,
  ): void {
    if (
      context.semanticPrefix.length !== 0 ||
      wrapper.type !== "export_statement"
    )
      return;
    this.exports.push({
      kind: "local",
      publicName: defaulted ? "default" : localName,
      localName,
      typeOnly: context.typeOnly,
    });
  }

  private scanCommonJs(): void {
    for (const statement of this.session.root.namedChildren) {
      if (statement.type === "comment") continue;
      if (
        statement.type === "lexical_declaration" ||
        statement.type === "variable_declaration"
      ) {
        this.inspectCommonJsDeclaration(statement);
        continue;
      }
      if (statement.type === "expression_statement") {
        const expression = statement.namedChildren[0];
        if (
          expression?.type === "assignment_expression" ||
          expression?.type === "augmented_assignment_expression"
        ) {
          this.scanCommonJsAssignment(expression);
          continue;
        }
      }
      if (this.containsCommonJsMutation(statement, true))
        this.problem(
          "javascript-commonjs-control-flow",
          "A CommonJS export changes through unsupported control flow or mutation.",
          "Assign static export names in unconditional top-level statements.",
          statement,
        );
      else if (this.escapesCommonJsObject(statement))
        this.problem(
          "javascript-commonjs-alias",
          "The CommonJS export object escapes through an unsupported alias or call.",
          "Write exports through module.exports or its active exports alias directly.",
          statement,
        );
    }
    this.exports.push(...this.commonJsExports.values());
  }

  private inspectCommonJsDeclaration(declaration: Node): void {
    for (const declarator of declaration.namedChildren) {
      if (declarator.type !== "variable_declarator") continue;
      const names = EcmaScriptSyntax.bindings(
        declarator.childForFieldName("name"),
      ).flatMap((node) => {
        const name = EcmaScriptSyntax.name(node);
        return name === undefined ? [] : [name];
      });
      if (names.includes("exports") || names.includes("module"))
        this.problem(
          "javascript-commonjs-shadow",
          "A top-level declaration shadows the CommonJS module bindings.",
          "Rename the declaration or use ECMAScript module syntax.",
          declarator,
        );
      const value = declarator.childForFieldName("value");
      if (value !== null && this.commonJsObject(value) !== undefined)
        this.problem(
          "javascript-commonjs-alias",
          "The CommonJS export object is captured by an unsupported alias.",
          "Write exports through module.exports or its active exports alias directly.",
          declarator,
        );
    }
  }

  private scanCommonJsAssignment(assignment: Node): void {
    const left = assignment.childForFieldName("left");
    const right = assignment.childForFieldName("right");
    if (left === null || right === null) return;
    if (!EcmaScriptSyntax.token(assignment, "=")) {
      if (this.commonJsAssignmentTarget(left))
        this.problem(
          "javascript-commonjs-mutation",
          "A compound CommonJS assignment makes the public surface conditional on runtime state.",
          "Use one unconditional '=' assignment for the static export name.",
          assignment,
        );
      return;
    }
    if (left.type === "identifier" && left.text === "exports") {
      if (this.exportsObject(right)) return;
      this.commonJsAliasAttached = this.moduleExports(right);
      return;
    }
    if (this.moduleExports(left)) {
      if (
        this.moduleExports(right) ||
        (this.exportsObject(right) && this.commonJsAliasAttached)
      )
        return;
      if (this.exportsObject(right)) {
        this.problem(
          "javascript-commonjs-replacement",
          "module.exports is replaced with a detached exports binding.",
          "Assign a static object or a local declaration directly to module.exports.",
          assignment,
        );
        return;
      }
      this.replaceCommonJs(right, assignment);
      return;
    }
    const name = this.commonJsProperty(left);
    if (name !== undefined) {
      if (this.exportsProperty(left) && !this.commonJsAliasAttached) return;
      if (!this.commonJsStaticObject) {
        this.problem(
          "javascript-commonjs-target",
          "A property is assigned after module.exports was replaced with an opaque local value.",
          "Use one static object replacement or avoid later property assignments.",
          assignment,
        );
        return;
      }
      this.bindCommonJs(name, right, assignment);
      return;
    }
    if (this.computedCommonJsProperty(left)) {
      this.problem(
        "javascript-commonjs-computed",
        "A computed CommonJS export key cannot establish a complete public surface.",
        "Use a direct static property name for every CommonJS export.",
        assignment,
      );
      return;
    }
    if (
      this.containsCommonJsMutation(assignment, false) ||
      this.escapesCommonJsObject(assignment)
    )
      this.problem(
        "javascript-commonjs-mutation",
        "A CommonJS export changes through an unsupported assignment.",
        "Use a direct static assignment with a local declaration as its value.",
        assignment,
      );
  }

  private replaceCommonJs(right: Node, assignment: Node): void {
    this.commonJsExports.clear();
    this.commonJsAliasAttached = false;
    if (right.type === "identifier") {
      this.commonJsStaticObject = false;
      this.commonJsExports.set("default", {
        kind: "local",
        publicName: "default",
        localName: right.text,
        typeOnly: false,
      });
      return;
    }
    if (right.type !== "object") {
      this.commonJsStaticObject = false;
      this.problem(
        "javascript-commonjs-replacement",
        "A CommonJS module replacement has no statically enumerable public surface.",
        "Replace module.exports with an object of static keys and local declaration values.",
        assignment,
      );
      return;
    }
    this.commonJsStaticObject = true;
    for (const child of right.namedChildren) {
      if (
        child.type === "shorthand_property_identifier" ||
        child.type === "shorthand_property_identifier_pattern"
      ) {
        this.commonJsExports.set(child.text, {
          kind: "local",
          publicName: child.text,
          localName: child.text,
          typeOnly: false,
        });
        continue;
      }
      if (child.type === "pair") {
        const name = EcmaScriptSyntax.name(child.childForFieldName("key"));
        const value = child.childForFieldName("value");
        if (name === "__proto__") {
          this.problem(
            "javascript-commonjs-prototype",
            "A __proto__ object entry changes the CommonJS export prototype instead of defining a public property.",
            "Use an ordinary static export name.",
            child,
          );
          continue;
        }
        if (name !== undefined && value?.type === "identifier") {
          this.commonJsExports.set(name, {
            kind: "local",
            publicName: name,
            localName: value.text,
            typeOnly: false,
          });
          continue;
        }
      }
      this.problem(
        "javascript-commonjs-object",
        "A CommonJS export object contains a non-static key or non-local value.",
        "Use static object keys whose values are local declaration identifiers.",
        child,
      );
    }
  }

  private bindCommonJs(name: string, right: Node, assignment: Node): void {
    if (name === "__proto__") {
      this.problem(
        "javascript-commonjs-prototype",
        "Assigning __proto__ changes the CommonJS export prototype instead of defining a public property.",
        "Use an ordinary static export name.",
        assignment,
      );
      return;
    }
    if (right.type !== "identifier") {
      this.problem(
        "javascript-commonjs-value",
        `CommonJS export '${name}' is not bound to a local declaration identifier.`,
        "Name the value locally before assigning it to the static export property.",
        assignment,
      );
      return;
    }
    this.commonJsExports.set(name, {
      kind: "local",
      publicName: name,
      localName: right.text,
      typeOnly: false,
    });
  }

  private commonJsProperty(node: Node): string | undefined {
    if (node.type !== "member_expression") return undefined;
    const object = node.childForFieldName("object");
    if (!this.exportsObject(object) && !this.moduleExports(object))
      return undefined;
    return EcmaScriptSyntax.name(node.childForFieldName("property"));
  }

  private computedCommonJsProperty(node: Node): boolean {
    if (node.type !== "subscript_expression") return false;
    const object = node.childForFieldName("object");
    return this.exportsObject(object) || this.moduleExports(object);
  }

  private exportsObject(node: Node | null): boolean {
    return node?.type === "identifier" && node.text === "exports";
  }

  private exportsProperty(node: Node): boolean {
    return (
      node.type === "member_expression" &&
      this.exportsObject(node.childForFieldName("object"))
    );
  }

  private moduleExports(node: Node | null): boolean {
    if (node?.type !== "member_expression") return false;
    const object = node.childForFieldName("object");
    const property = node.childForFieldName("property");
    return (
      object?.type === "identifier" &&
      object.text === "module" &&
      EcmaScriptSyntax.name(property) === "exports"
    );
  }

  private commonJsObject(node: Node): "exports" | "module" | undefined {
    if (this.exportsObject(node)) return "exports";
    return this.moduleExports(node) ? "module" : undefined;
  }

  private containsCommonJsMutation(node: Node, nested: boolean): boolean {
    if (
      nested &&
      (node.type === "function_declaration" ||
        node.type === "generator_function_declaration" ||
        node.type === "class_declaration")
    )
      return false;
    if (
      node.type === "assignment_expression" ||
      node.type === "augmented_assignment_expression"
    ) {
      const left = node.childForFieldName("left");
      if (left !== null && this.commonJsAssignmentTarget(left)) return true;
    }
    if (
      node.type === "unary_expression" &&
      EcmaScriptSyntax.token(node, "delete")
    )
      if (
        node.namedChildren.some((child) => this.commonJsAssignmentTarget(child))
      )
        return true;
    if (node.type === "update_expression")
      if (
        node.namedChildren.some((child) => this.commonJsAssignmentTarget(child))
      )
        return true;
    return node.namedChildren.some((child) =>
      this.containsCommonJsMutation(child, nested),
    );
  }

  private commonJsAssignmentTarget(node: Node): boolean {
    if (
      (node.type === "identifier" &&
        (node.text === "exports" || node.text === "module")) ||
      this.moduleExports(node) ||
      this.commonJsProperty(node) !== undefined ||
      this.computedCommonJsProperty(node)
    )
      return true;
    return node.namedChildren.some((child) =>
      this.commonJsAssignmentTarget(child),
    );
  }

  private escapesCommonJsObject(node: Node): boolean {
    if (
      node.type === "function_declaration" ||
      node.type === "generator_function_declaration" ||
      node.type === "class_declaration"
    )
      return false;
    if (this.commonJsObject(node) !== undefined) {
      const parent = node.parent;
      if (parent !== null && parent.type === "member_expression") {
        const object = parent.childForFieldName("object");
        if (object !== null && object.equals(node)) return false;
      }
      if (
        parent !== null &&
        (parent.type === "assignment_expression" ||
          parent.type === "augmented_assignment_expression")
      ) {
        const left = parent.childForFieldName("left");
        if (left !== null && left.equals(node)) return false;
      }
      return true;
    }
    return node.namedChildren.some((child) =>
      this.escapesCommonJsObject(child),
    );
  }

  private addUnit(
    siteNode: Node,
    contentNode: Node,
    symbol: EvidenceProgrammingSymbol,
    identity: string[],
    root: string,
    suffix: string[],
    parentId: string | undefined,
    typeSpace: boolean,
    valueSpace: boolean,
    extraHost?: Node,
    attachDocumentation: boolean = true,
  ): IEcmaScriptOwnedUnit {
    const id = `${this.type}:${this.source.id}:${symbol}:${JSON.stringify(identity)}`;
    const siteId = this.siteId(siteNode);
    const site: IEvidenceUnitSite = {
      id: siteId,
      file: this.source.physicalPath,
      range: this.session.range(siteNode),
      content: [this.session.range(contentNode)],
    };
    let record = this.units.get(id);
    if (record === undefined) {
      const unit: IEvidenceUnit = {
        id,
        type: this.type,
        symbol,
        identity,
        name: identity.at(-1) ?? "",
        sites: [site],
        withdrawals: [],
        ...(parentId === undefined ? {} : { parentId }),
      };
      record = { unit, root, suffix, typeSpace, valueSpace };
      this.units.set(id, record);
    } else {
      const previous = record.unit.sites.find(
        (candidate) => candidate.id === site.id,
      );
      if (previous === undefined) record.unit.sites.push(site);
      else previous.content.push(...site.content);
      record.typeSpace ||= typeSpace;
      record.valueSpace ||= valueSpace;
    }
    this.registerHost(siteNode, siteId, id, attachDocumentation);
    if (extraHost !== undefined)
      this.registerHost(extraHost, siteId, id, attachDocumentation);
    return record;
  }

  private registerHost(
    node: Node,
    siteId: string,
    unitId: string,
    attachDocumentation: boolean,
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
    if (attachDocumentation) this.attach(node, id, siteId, unitId, false);
  }

  private attach(
    node: Node,
    positionId: string | undefined,
    siteId: string,
    unitId: string,
    withdrawalOnly: boolean = false,
  ): void {
    let current = node.previousNamedSibling;
    let boundary = node.startIndex;
    while (current !== null && current.type === "comment") {
      if (this.source.content.slice(current.endIndex, boundary).trim() !== "")
        break;
      if (!EcmaScriptSyntax.jsdoc(current)) break;
      const comment = this.comments.get(this.commentKey(current));
      if (comment !== undefined) {
        const attachment = comment.attachments.find(
          (entry) =>
            entry.positionId === positionId &&
            entry.siteId === siteId &&
            entry.unitId === unitId,
        );
        if (attachment === undefined)
          comment.attachments.push({
            ...(positionId === undefined ? {} : { positionId }),
            siteId,
            unitId,
            ...(withdrawalOnly ? { withdrawalOnly: true } : {}),
          });
        else if (!withdrawalOnly) delete attachment.withdrawalOnly;
      }
      boundary = current.startIndex;
      current = current.previousNamedSibling;
    }
  }

  private declaration(statement: Node): Node {
    let declaration =
      statement.childForFieldName("declaration") ??
      statement.childForFieldName("value") ??
      statement;
    if (declaration.type === "expression_statement") {
      const module = declaration.namedChildren.find(
        (child) => child.type === "internal_module",
      );
      if (module !== undefined) declaration = module;
    }
    while (declaration.type === "ambient_declaration") {
      const nested = declaration.namedChildren.find(
        (child) =>
          child.type.endsWith("_declaration") ||
          child.type.endsWith("_signature") ||
          child.type === "internal_module" ||
          child.type === "module",
      );
      if (nested === undefined) break;
      declaration = nested;
    }
    return declaration;
  }

  private declarationFile(): boolean {
    return [
      this.source.physicalPath,
      ...this.source.addresses.flatMap((address) => [
        address.absolute,
        address.relative,
      ]),
    ].some((file) => /\.d\.(?:cts|mts|ts)$/iu.test(file));
  }

  private exportedDeclaration(node: Node | null): boolean {
    return (
      node !== null &&
      (node.type === "class" ||
        node.type === "class_declaration" ||
        node.type === "abstract_class_declaration" ||
        node.type === "function_declaration" ||
        node.type === "function_expression" ||
        node.type === "function_signature" ||
        node.type === "generator_function" ||
        node.type === "generator_function_declaration")
    );
  }

  private commentKey(node: Node): string {
    return `${node.startIndex}:${node.endIndex}`;
  }

  private siteId(node: Node): string {
    return `${this.type}:${this.source.id}:site:${node.startIndex}:${node.endIndex}`;
  }

  private positionId(node: Node): string {
    return `${this.type}:${this.source.id}:position:${node.startIndex}:${node.endIndex}`;
  }

  private problem(
    code: string,
    message: string,
    repair: string,
    node: Node,
  ): void {
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

  private language(): string {
    return this.type === "typescript" ? "TypeScript" : "JavaScript";
  }
}
