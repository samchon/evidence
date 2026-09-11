import type { Node } from "web-tree-sitter";

import type { EvidenceParseSession } from "../EvidenceParseSession";
import type { IEvidenceDiagnostic } from "../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IEvidenceUnit } from "../structures/IEvidenceUnit";
import type { IEvidenceUnitSite } from "../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../typings/EvidenceProgrammingSymbol";
import type { ITypeScriptComment } from "./ITypeScriptComment";
import type { ITypeScriptExport } from "./ITypeScriptExport";
import type { ITypeScriptFileAnalysis } from "./ITypeScriptFileAnalysis";
import type { ITypeScriptHostPosition } from "./ITypeScriptHostPosition";
import type { ITypeScriptImport } from "./ITypeScriptImport";
import type { ITypeScriptOwnedUnit } from "./ITypeScriptOwnedUnit";
import type { ITypeScriptStatementContext } from "./ITypeScriptStatementContext";
import { TypeScriptSyntax } from "./TypeScriptSyntax";

/** Extracts local TypeScript declarations before module exports assign public addresses. */
export class TypeScriptFileScanner {
  private readonly units = new Map<string, ITypeScriptOwnedUnit>();
  private readonly excludedRoots = new Set<string>();
  private readonly comments = new Map<string, ITypeScriptComment>();
  private readonly exports: ITypeScriptExport[] = [];
  private readonly positions = new Map<string, ITypeScriptHostPosition>();
  private readonly imports: ITypeScriptImport[] = [];
  private readonly diagnostics: IEvidenceDiagnostic[] = [];
  private complete = true;

  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
  ) {
    for (const node of session.root.descendantsOfType("comment")) {
      const range = session.range(node);
      this.comments.set(this.commentKey(node), {
        id: `typescript:${source.id}:comment:${range.start.offset}`,
        range,
        syntax: TypeScriptSyntax.comment(node),
        attachments: [],
      });
    }
  }

  public scan(): ITypeScriptFileAnalysis {
    this.collectImports();
    this.scanStatements(this.session.root, {
      semanticPrefix: [],
      publicPrefix: [],
      ambient: this.declarationFile(),
      visible: true,
      typeOnly: false,
    });
    return {
      source: this.source,
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
      const specifier = TypeScriptSyntax.module(
        statement.childForFieldName("source"),
      );
      if (specifier === undefined) {
        this.problem(
          "typescript-import",
          "A TypeScript import has no static string module specifier.",
          "Use a string-literal module specifier before re-exporting its bindings.",
          statement,
        );
        continue;
      }
      const clause = statement.namedChildren.find(
        (child) => child.type === "import_clause",
      );
      if (clause === undefined) continue;
      const statementTypeOnly = TypeScriptSyntax.token(statement, "type");
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
        const imported = TypeScriptSyntax.name(entry.childForFieldName("name"));
        const local =
          TypeScriptSyntax.name(entry.childForFieldName("alias")) ?? imported;
        if (imported === undefined || local === undefined) continue;
        this.imports.push({
          localName: local,
          importedName: imported,
          specifier,
          typeOnly: statementTypeOnly || TypeScriptSyntax.token(entry, "type"),
          namespace: false,
        });
      }
    }
  }

  private scanStatements(
    block: Node,
    inherited: ITypeScriptStatementContext,
  ): void {
    const declarations = block.namedChildren.filter(
      (child) => child.type !== "comment",
    );
    const functionNames = new Set<string>();
    const classNames = new Set<string>();
    for (const statement of declarations) {
      const declaration = this.declaration(statement);
      const name = TypeScriptSyntax.qualifiedName(
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
      const context: ITypeScriptStatementContext = {
        ...inherited,
        ambient:
          inherited.ambient ||
          statement.type === "ambient_declaration" ||
          statement.namedChildren.some(
            (child) => child.type === "ambient_declaration",
          ),
        visible,
        typeOnly:
          inherited.typeOnly ||
          (statement.type === "export_statement" &&
            TypeScriptSyntax.token(statement, "type")),
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
    context: ITypeScriptStatementContext,
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
    context: ITypeScriptStatementContext,
    classNames: Set<string>,
  ): void {
    const local = TypeScriptSyntax.name(declaration.childForFieldName("name"));
    if (local === undefined || !context.visible) return;
    const defaulted =
      wrapper.type === "export_statement" &&
      TypeScriptSyntax.token(wrapper, "default");
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
    context: ITypeScriptStatementContext,
  ): void {
    if (!context.visible) return;
    const local = TypeScriptSyntax.name(declaration.childForFieldName("name"));
    if (local === undefined) return;
    this.excludedRoots.add(local);
    this.directExport(wrapper, local, context, false);
  }

  private scanTypeAlias(
    wrapper: Node,
    declaration: Node,
    context: ITypeScriptStatementContext,
  ): void {
    const local = TypeScriptSyntax.name(declaration.childForFieldName("name"));
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
    context: ITypeScriptStatementContext,
  ): void {
    const declared = TypeScriptSyntax.name(
      declaration.childForFieldName("name"),
    );
    const defaulted =
      wrapper.type === "export_statement" &&
      TypeScriptSyntax.token(wrapper, "default");
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
    context: ITypeScriptStatementContext,
  ): void {
    if (context.typeOnly || !context.visible) return;
    const declared = TypeScriptSyntax.name(
      declaration.childForFieldName("name"),
    );
    const defaulted =
      wrapper.type === "export_statement" &&
      TypeScriptSyntax.token(wrapper, "default");
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
    context: ITypeScriptStatementContext,
  ): void {
    if (context.typeOnly || !context.visible) return;
    const constant = TypeScriptSyntax.token(declaration, "const");
    for (const declarator of declaration.namedChildren) {
      if (declarator.type !== "variable_declarator") continue;
      const bindingNode = declarator.childForFieldName("name");
      const value = declarator.childForFieldName("value");
      const callable =
        constant &&
        bindingNode?.type === "identifier" &&
        TypeScriptSyntax.functionValue(value);
      const symbol: EvidenceProgrammingSymbol = callable
        ? "function"
        : "property";
      for (const binding of TypeScriptSyntax.bindings(bindingNode)) {
        const local = TypeScriptSyntax.name(binding);
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
    context: ITypeScriptStatementContext,
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
    const names = TypeScriptSyntax.qualifiedName(nameNode);
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
        context.ambient || TypeScriptSyntax.modifier(declaration, "declare"),
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
          TypeScriptSyntax.token(member, "get") ||
          TypeScriptSyntax.token(member, "set")
        )
          continue;
        symbol = "function";
      } else if (member.type === "property_signature")
        symbol = TypeScriptSyntax.functionType(member.childForFieldName("type"))
          ? "function"
          : "property";
      else continue;
      const name = TypeScriptSyntax.name(member.childForFieldName("name"));
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
        TypeScriptSyntax.name(member.childForFieldName("name")) ===
        "constructor"
      );
    });
    for (const member of body.namedChildren) {
      if (member.type === "comment") continue;
      const name = TypeScriptSyntax.name(member.childForFieldName("name"));
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
      if (!TypeScriptSyntax.publicMember(member)) continue;
      if (method) {
        if (
          TypeScriptSyntax.token(member, "get") ||
          TypeScriptSyntax.token(member, "set")
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
      } else if (member.type === "public_field_definition") {
        const symbol: EvidenceProgrammingSymbol =
          TypeScriptSyntax.functionValue(member.childForFieldName("value")) ||
          TypeScriptSyntax.functionType(member.childForFieldName("type"))
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
        !TypeScriptSyntax.modifier(parameter, "readonly") &&
        !TypeScriptSyntax.modifier(parameter, "override")
      )
        continue;
      if (!TypeScriptSyntax.publicMember(parameter)) continue;
      const pattern = parameter.childForFieldName("pattern");
      const name = TypeScriptSyntax.name(pattern);
      if (name === undefined) continue;
      const symbol: EvidenceProgrammingSymbol =
        TypeScriptSyntax.functionValue(parameter.childForFieldName("value")) ||
        TypeScriptSyntax.functionType(parameter.childForFieldName("type"))
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
    const statically = TypeScriptSyntax.modifier(member, "static");
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
    context: ITypeScriptStatementContext,
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
    if (TypeScriptSyntax.token(statement, "=")) {
      this.problem(
        "typescript-export-assignment",
        "A CommonJS export assignment has no stable ECMAScript export name.",
        "Replace 'export =' with named or default ECMAScript exports.",
        statement,
      );
      return;
    }
    if (
      TypeScriptSyntax.token(statement, "as") &&
      TypeScriptSyntax.token(statement, "namespace")
    ) {
      this.problem(
        "typescript-umd-export",
        "A UMD global namespace export is outside file-qualified module resolution.",
        "Use ECMAScript exports or add UMD global resolution to this adapter.",
        statement,
      );
      return;
    }
    const specifier = TypeScriptSyntax.module(
      statement.childForFieldName("source"),
    );
    const typeOnly = TypeScriptSyntax.token(statement, "type");
    const clause = statement.namedChildren.find(
      (child) => child.type === "export_clause",
    );
    const namespace = statement.namedChildren.find(
      (child) => child.type === "namespace_export",
    );
    if (namespace !== undefined && specifier !== undefined) {
      const publicName = TypeScriptSyntax.name(
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
        const local = TypeScriptSyntax.name(child.childForFieldName("name"));
        const publicName =
          TypeScriptSyntax.name(child.childForFieldName("alias")) ?? local;
        if (local === undefined || publicName === undefined) continue;
        this.exports.push(
          specifier === undefined
            ? {
                kind: "local",
                publicName,
                localName: local,
                typeOnly: typeOnly || TypeScriptSyntax.token(child, "type"),
              }
            : {
                kind: "named",
                publicName,
                importedName: local,
                specifier,
                typeOnly: typeOnly || TypeScriptSyntax.token(child, "type"),
              },
        );
      }
      return;
    }
    if (specifier !== undefined)
      this.exports.push({ kind: "star", specifier, typeOnly });
    else if (statement.childForFieldName("value") !== null) {
      const value = statement.childForFieldName("value");
      const localName = TypeScriptSyntax.name(value);
      if (localName === undefined)
        this.problem(
          "typescript-default-export",
          "A default export expression has no statically resolvable local declaration.",
          "Name the declaration or export a local identifier as default.",
          statement,
        );
      else
        this.exports.push({
          kind: "local",
          publicName: "default",
          localName,
          typeOnly: false,
        });
    }
  }

  private directExport(
    wrapper: Node,
    localName: string,
    context: ITypeScriptStatementContext,
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
  ): ITypeScriptOwnedUnit {
    const id = `typescript:${this.source.id}:${symbol}:${JSON.stringify(identity)}`;
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
        type: "typescript",
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
      if (!TypeScriptSyntax.jsdoc(current)) break;
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
    return `typescript:${this.source.id}:site:${node.startIndex}:${node.endIndex}`;
  }

  private positionId(node: Node): string {
    return `typescript:${this.source.id}:position:${node.startIndex}:${node.endIndex}`;
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
}
