import type { Node } from "web-tree-sitter";

import { EvidenceDocumentation } from "../../parsers/EvidenceDocumentation";
import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { IRubyConstantPath } from "./IRubyConstantPath";
import type { IRubyDeclaration } from "./IRubyDeclaration";
import type { IRubyDocumentation } from "./IRubyDocumentation";
import type { IRubyFileAnalysis } from "./IRubyFileAnalysis";
import type { IRubyScopeContext } from "./IRubyScopeContext";
import type { RubyAttributeMode } from "./RubyAttributeMode";
import type { RubyContainerKind } from "./RubyContainerKind";
import type { RubyDeclarationForm } from "./RubyDeclarationForm";
import type { RubyMethodSide } from "./RubyMethodSide";
import { RubySyntax } from "./RubySyntax";
import type { RubyVisibility } from "./RubyVisibility";
import { SourceText } from "../../internal/SourceText";

/** Extracts bounded Ruby declarations, visibility changes, and documentation carriers. */
export class RubyFileScanner {
  private readonly declarations: IRubyDeclaration[] = [];
  private readonly documentation = new Map<string, IRubyDocumentation>();
  private readonly diagnostics: IEvidenceDiagnostic[] = [];
  private readonly reported = new Set<string>();
  private readonly constantVisibility = new Map<string, RubyVisibility>();
  private readonly text: SourceText;
  private complete = true;
  private serial = 0;

  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
  ) {
    this.text = new SourceText(source.content);
    this.collectDocumentation();
    this.collectLiteralAnnotations();
  }

  public scan(): IRubyFileAnalysis {
    const root: IRubyScopeContext = {
      kind: "top",
      identity: [],
      side: "instance",
      visibility: "private",
      moduleFunction: false,
    };
    this.scanBody(this.session.root, root);
    return {
      source: this.source,
      declarations: this.declarations,
      documentation: Array.from(this.documentation.values()),
      diagnostics: this.diagnostics,
      complete: this.complete,
    };
  }

  private scanBody(body: Node, context: IRubyScopeContext): void {
    for (const statement of body.namedChildren)
      this.scanStatement(statement, context);
  }

  private scanStatement(statement: Node, context: IRubyScopeContext): void {
    switch (statement.type) {
      case "comment":
      case "heredoc_body":
      case "empty_statement":
        return;
      case "class":
        this.scanContainer(statement, context, "class");
        return;
      case "module":
        this.scanContainer(statement, context, "module");
        return;
      case "singleton_class":
        this.scanSingletonClass(statement, context);
        return;
      case "method":
        this.scanMethod(statement, statement, context);
        return;
      case "singleton_method":
        this.scanSingletonMethod(statement, statement, context);
        return;
      case "assignment":
        this.scanAssignment(statement, context);
        return;
      case "alias":
        this.scanAlias(statement, statement, context);
        return;
      case "undef":
        if (context.kind !== "top")
          this.problem(
            "ruby-method-removal",
            "Ruby undef removes methods from the selected declared surface.",
            "Replace the removal with an explicit final declaration or add load-order-aware analysis.",
            statement,
          );
        return;
      case "identifier":
        this.scanBareDirective(statement, context);
        return;
      case "call":
        this.scanCall(statement, context);
        return;
      default:
        if (this.containsSurfaceChange(statement))
          this.problem(
            "ruby-conditional-surface",
            `Ruby '${statement.type}' conditionally changes the selected public surface.`,
            "Move declarations and public-surface macros into an unconditional class or module body, or add control-flow analysis.",
            statement,
          );
    }
  }

  private scanContainer(
    statement: Node,
    context: IRubyScopeContext,
    kind: RubyContainerKind,
  ): void {
    if (context.kind === "singleton") {
      this.problem(
        "ruby-singleton-constant",
        "A class or module declaration inside a singleton class has unsupported constant ownership.",
        "Declare the constant in an ordinary class or module body.",
        statement,
      );
      return;
    }
    const path = RubySyntax.constantPath(statement.childForFieldName("name"));
    if (path === undefined) {
      this.problem(
        "ruby-container-name",
        `A Ruby ${kind} has no statically readable constant path.`,
        "Use a named constant or constant path for the declaration.",
        statement,
      );
      return;
    }
    const identity = this.resolvePath(path, context);
    const visibility =
      this.constantVisibility.get(this.identityKey(identity)) ?? "public";
    this.addDeclaration(
      statement,
      statement,
      "type",
      kind,
      identity.at(-1) ?? "",
      identity.at(-1) ?? "",
      identity,
      identity,
      visibility,
      true,
      identity.slice(0, -1),
      [this.session.range(statement)],
      undefined,
      undefined,
      kind,
      kind === "class" ? RubySyntax.superclass(statement) : undefined,
    );
    const body = statement.childForFieldName("body");
    if (body === null) return;
    const nested: IRubyScopeContext = {
      kind,
      identity,
      side: "instance",
      visibility: "public",
      moduleFunction: false,
      containerKind: kind,
    };
    this.scanBody(body, nested);
  }

  private scanSingletonClass(
    statement: Node,
    context: IRubyScopeContext,
  ): void {
    if (context.kind === "singleton") {
      this.problem(
        "ruby-nested-singleton",
        "A singleton class opened from another singleton class targets an unsupported eigenclass level.",
        "Declare class or module singleton methods directly with def self.name.",
        statement,
      );
      return;
    }
    const value = statement.childForFieldName("value");
    const identity =
      value?.type === "self" && context.kind !== "top"
        ? context.identity
        : this.resolveOptionalPath(RubySyntax.constantPath(value), context);
    if (identity === undefined || identity.length === 0) {
      if (this.containsSurfaceChange(statement))
        this.problem(
          "ruby-singleton-owner",
          "A singleton class with public declarations has no statically selected constant owner.",
          "Open class << self inside a supported class or module, or use a literal constant path.",
          statement,
        );
      return;
    }
    const body = statement.childForFieldName("body");
    if (body === null) return;
    const singleton: IRubyScopeContext = {
      kind: "singleton",
      identity,
      side: "singleton",
      visibility: "public",
      moduleFunction: false,
      ...(context.containerKind === undefined
        ? {}
        : { containerKind: context.containerKind }),
    };
    this.scanBody(body, singleton);
  }

  private scanMethod(
    method: Node,
    wrapper: Node,
    context: IRubyScopeContext,
    forcedVisibility?: RubyVisibility,
    forcedModuleFunction: boolean = false,
  ): void {
    if (context.kind === "top") return;
    const name = RubySyntax.methodName(method.childForFieldName("name"));
    if (name === undefined) {
      this.problem(
        "ruby-method-name",
        "A Ruby method has no statically readable name.",
        "Use an identifier, setter, or operator method name.",
        method,
      );
      return;
    }
    const moduleFunction =
      context.kind === "module" &&
      context.side === "instance" &&
      (forcedModuleFunction || context.moduleFunction);
    const visibility = moduleFunction
      ? "private"
      : (forcedVisibility ??
        (name === "initialize" ? "private" : context.visibility));
    const declaration = this.addMethod(
      method,
      wrapper,
      context,
      name,
      visibility,
      context.side === "singleton" ? "singleton-method" : "method",
    );
    if (moduleFunction) this.cloneModuleFunction(declaration);
  }

  private scanSingletonMethod(
    method: Node,
    wrapper: Node,
    context: IRubyScopeContext,
    forcedVisibility?: RubyVisibility,
  ): void {
    if (context.kind === "singleton") {
      this.problem(
        "ruby-nested-singleton",
        "def self.name inside a singleton class targets an unsupported eigenclass level.",
        "Use an ordinary def name inside class << self.",
        method,
      );
      return;
    }
    const object = method.childForFieldName("object");
    const identity =
      object?.type === "self" && context.kind !== "top"
        ? context.identity
        : this.resolveOptionalPath(RubySyntax.constantPath(object), context);
    if (identity === undefined || identity.length === 0) {
      if (context.kind !== "top" || object?.type !== "self")
        this.problem(
          "ruby-singleton-owner",
          "A singleton method has no statically selected class or module owner.",
          "Use def self.name inside a supported class or module, or use a literal constant path.",
          method,
        );
      return;
    }
    const name = RubySyntax.methodName(method.childForFieldName("name"));
    if (name === undefined) {
      this.problem(
        "ruby-method-name",
        "A Ruby singleton method has no statically readable name.",
        "Use an identifier, setter, or operator method name.",
        method,
      );
      return;
    }
    const owner: IRubyScopeContext = {
      kind: "singleton",
      identity,
      side: "singleton",
      visibility: forcedVisibility ?? "public",
      moduleFunction: false,
      ...(context.containerKind === undefined
        ? {}
        : { containerKind: context.containerKind }),
    };
    this.addMethod(
      method,
      wrapper,
      owner,
      name,
      forcedVisibility ?? "public",
      "singleton-method",
    );
  }

  private addMethod(
    method: Node,
    wrapper: Node,
    context: IRubyScopeContext,
    name: string,
    visibility: RubyVisibility,
    form: Extract<RubyDeclarationForm, "method" | "singleton-method">,
  ): IRubyDeclaration {
    const address = this.memberAddress(context.identity, context.side, name);
    return this.addDeclaration(
      method,
      wrapper,
      "function",
      form,
      name,
      name,
      address,
      address,
      visibility,
      true,
      context.identity,
      [this.session.range(method)],
      context.side,
      undefined,
      context.containerKind,
    );
  }

  private scanAssignment(statement: Node, context: IRubyScopeContext): void {
    const left = statement.childForFieldName("left");
    const path = RubySyntax.constantPath(left);
    if (path === undefined) {
      if (
        left !== null &&
        left.descendantsOfType("constant").length !== 0 &&
        context.kind !== "singleton"
      )
        this.problem(
          "ruby-constant-assignment",
          "A compound Ruby assignment contains constants that cannot be separated safely.",
          "Declare each public constant with one direct assignment.",
          statement,
        );
      return;
    }
    if (context.kind === "singleton") {
      this.problem(
        "ruby-singleton-constant",
        "A constant assignment inside a singleton class has unsupported ownership.",
        "Declare the constant in an ordinary class or module body.",
        statement,
      );
      return;
    }
    const identity = this.resolvePath(path, context);
    const visibility =
      this.constantVisibility.get(this.identityKey(identity)) ?? "public";
    this.addDeclaration(
      statement,
      statement,
      "property",
      "constant",
      identity.at(-1) ?? "",
      identity.at(-1) ?? "",
      identity,
      identity,
      visibility,
      true,
      identity.slice(0, -1),
      [this.session.range(statement)],
      undefined,
      undefined,
      context.containerKind,
    );
    if (RubySyntax.generatedConstant(statement.childForFieldName("right")))
      this.problem(
        "ruby-generated-constant",
        `Ruby constant '${identity.join("::")}' receives a runtime-generated class or module.`,
        "Use an explicit class or module declaration, or add generator-aware analysis for its members.",
        statement,
      );
  }

  private scanCall(call: Node, context: IRubyScopeContext): void {
    const name = RubySyntax.callName(call);
    if (name === undefined) return;
    if (!RubySyntax.hasReceiver(call)) {
      if (name === "public" || name === "private" || name === "protected") {
        this.scanVisibilityCall(call, context, name);
        return;
      }
      if (name === "public_class_method" || name === "private_class_method") {
        this.scanClassVisibilityCall(
          call,
          context,
          name === "public_class_method" ? "public" : "private",
        );
        return;
      }
      if (name === "public_constant" || name === "private_constant") {
        this.scanConstantVisibilityCall(
          call,
          context,
          name === "public_constant" ? "public" : "private",
        );
        return;
      }
      if (
        name === "attr_reader" ||
        name === "attr_writer" ||
        name === "attr_accessor"
      ) {
        this.scanAttribute(call, call, context);
        return;
      }
      if (name === "alias_method") {
        this.scanAliasCall(call, context);
        return;
      }
      if (name === "module_function") {
        this.scanModuleFunction(call, context);
        return;
      }
    }
    if (this.surfaceCall(name))
      this.problem(
        "ruby-dynamic-surface",
        `Ruby call '${name}' can change the public surface without a statically complete declaration.`,
        "Replace it with explicit declarations or add a bounded adapter rule for this metaprogramming form.",
        call,
      );
  }

  private scanBareDirective(statement: Node, context: IRubyScopeContext): void {
    const name = statement.text;
    if (name === "public" || name === "private" || name === "protected") {
      context.visibility = name;
      context.moduleFunction = false;
    } else if (name === "module_function") {
      if (context.kind !== "module" || context.side !== "instance")
        this.problem(
          "ruby-module-function-owner",
          "module_function is only supported in an ordinary module body.",
          "Move the directive into a module or declare singleton methods explicitly.",
          statement,
        );
      else {
        context.visibility = "private";
        context.moduleFunction = true;
      }
    }
  }

  private scanVisibilityCall(
    call: Node,
    context: IRubyScopeContext,
    visibility: RubyVisibility,
  ): void {
    const arguments_ = RubySyntax.callArguments(call);
    const wrapped = arguments_[0];
    if (arguments_.length === 1 && wrapped !== undefined) {
      if (wrapped.type === "method") {
        this.scanMethod(wrapped, call, context, visibility);
        return;
      }
      if (wrapped.type === "singleton_method") {
        this.scanSingletonMethod(wrapped, call, context);
        const name = RubySyntax.methodName(wrapped.childForFieldName("name"));
        if (name !== undefined)
          this.changeMethodVisibility(
            context.identity,
            context.kind === "singleton" ? "singleton" : "instance",
            name,
            visibility,
            call,
          );
        return;
      }
      if (
        wrapped.type === "call" &&
        ["attr_reader", "attr_writer", "attr_accessor"].includes(
          RubySyntax.callName(wrapped) ?? "",
        )
      ) {
        this.scanAttribute(wrapped, call, context, visibility);
        return;
      }
    }
    if (arguments_.length === 0) {
      context.visibility = visibility;
      context.moduleFunction = false;
      return;
    }
    const names = RubySyntax.literalNames(arguments_);
    if (names === undefined || names.length === 0) {
      this.dynamicDirective(call, "method visibility");
      return;
    }
    const side = context.kind === "singleton" ? "singleton" : "instance";
    for (const name of names)
      this.changeMethodVisibility(
        context.identity,
        side,
        name,
        visibility,
        call,
      );
  }

  private scanClassVisibilityCall(
    call: Node,
    context: IRubyScopeContext,
    visibility: Extract<RubyVisibility, "private" | "public">,
  ): void {
    if (context.kind !== "class" && context.kind !== "module") {
      this.problem(
        "ruby-class-visibility-owner",
        "Class-method visibility is only supported in an ordinary class or module body.",
        "Use private or public inside class << self, or move the directive into the owning class or module body.",
        call,
      );
      return;
    }
    const arguments_ = RubySyntax.callArguments(call);
    const wrapped = arguments_[0];
    if (arguments_.length === 1 && wrapped?.type === "singleton_method") {
      this.scanSingletonMethod(wrapped, call, context, visibility);
      return;
    }
    const names = RubySyntax.literalNames(arguments_);
    if (names === undefined || names.length === 0) {
      this.dynamicDirective(call, "class-method visibility");
      return;
    }
    for (const name of names)
      this.changeMethodVisibility(
        context.identity,
        "singleton",
        name,
        visibility,
        call,
      );
  }

  private scanConstantVisibilityCall(
    call: Node,
    context: IRubyScopeContext,
    visibility: Extract<RubyVisibility, "private" | "public">,
  ): void {
    if (context.kind === "singleton") {
      this.dynamicDirective(call, "constant visibility");
      return;
    }
    const names = RubySyntax.literalNames(RubySyntax.callArguments(call));
    if (
      names === undefined ||
      names.length === 0 ||
      names.some((name) => !/^[A-Z][A-Za-z0-9_]*$/u.test(name))
    ) {
      this.dynamicDirective(call, "constant visibility");
      return;
    }
    for (const name of names)
      this.changeConstantVisibility(
        [...context.identity, name],
        visibility,
        call,
      );
  }

  private scanAttribute(
    call: Node,
    wrapper: Node,
    context: IRubyScopeContext,
    forcedVisibility?: RubyVisibility,
  ): void {
    if (context.kind === "top") return;
    const callName = RubySyntax.callName(call);
    if (
      callName !== "attr_reader" &&
      callName !== "attr_writer" &&
      callName !== "attr_accessor"
    )
      return;
    const arguments_ = RubySyntax.callArguments(call);
    const names = arguments_.map((argument) =>
      RubySyntax.literalName(argument),
    );
    if (
      names.length === 0 ||
      names.some((name) => name === undefined || name.length === 0)
    ) {
      this.problem(
        "ruby-dynamic-attribute",
        `Ruby ${callName} contains a nonliteral attribute name.`,
        "Use literal symbol or string names in attr_reader, attr_writer, or attr_accessor.",
        call,
      );
      return;
    }
    if (context.kind === "module" && context.moduleFunction)
      this.problem(
        "ruby-module-function-attribute",
        "An attribute declaration under module_function mode has unsupported copy semantics.",
        "Declare explicit instance and singleton accessors, or reset visibility before the attribute declaration.",
        call,
      );
    const visibility = forcedVisibility ?? context.visibility;
    const modes: RubyAttributeMode[] =
      callName === "attr_reader"
        ? ["read"]
        : callName === "attr_writer"
          ? ["write"]
          : ["read", "write"];
    const method = call.childForFieldName("method");
    for (let index = 0; index < arguments_.length; ++index) {
      const argument = arguments_[index];
      const name = names[index];
      if (argument === undefined || name === undefined) continue;
      for (const mode of modes) {
        const runtimeName = mode === "write" ? `${name}=` : name;
        const address = this.memberAddress(
          context.identity,
          context.side,
          name,
        );
        this.addDeclaration(
          argument,
          wrapper,
          "property",
          "attribute",
          name,
          runtimeName,
          address,
          address,
          visibility,
          true,
          context.identity,
          [
            ...(method === null ? [] : [this.session.range(method)]),
            this.session.range(argument),
          ],
          context.side,
          mode,
          context.containerKind,
        );
      }
    }
  }

  private scanAlias(
    statement: Node,
    wrapper: Node,
    context: IRubyScopeContext,
  ): void {
    if (context.kind === "top") return;
    const name = RubySyntax.methodName(statement.childForFieldName("name"));
    const target = RubySyntax.methodName(statement.childForFieldName("alias"));
    if (name === undefined || target === undefined) {
      this.problem(
        "ruby-alias-name",
        "A Ruby alias has a name that cannot be resolved statically.",
        "Use literal method names in the alias statement.",
        statement,
      );
      return;
    }
    this.addAlias(statement, wrapper, context, name, target);
  }

  private scanAliasCall(call: Node, context: IRubyScopeContext): void {
    if (context.kind === "top") return;
    const names = RubySyntax.literalNames(RubySyntax.callArguments(call));
    if (names?.length !== 2) {
      this.problem(
        "ruby-alias-name",
        "alias_method requires two statically readable method names.",
        "Use two literal symbol or string method names.",
        call,
      );
      return;
    }
    const name = names[0];
    const target = names[1];
    if (name !== undefined && target !== undefined)
      this.addAlias(call, call, context, name, target);
  }

  private addAlias(
    statement: Node,
    wrapper: Node,
    context: IRubyScopeContext,
    name: string,
    targetName: string,
  ): void {
    const candidates = this.methodDeclarations(
      context.identity,
      context.side,
      targetName,
    ).filter((declaration) => declaration.symbol === "function");
    if (candidates.length !== 1) {
      this.problem(
        "ruby-alias-target",
        `Ruby alias '${name}' cannot identify one selected prior method '${targetName}'.`,
        "Define the target method once earlier in the same selected file before aliasing it.",
        statement,
      );
      return;
    }
    const target = candidates[0];
    if (target === undefined) return;
    const address = this.memberAddress(context.identity, context.side, name);
    this.addDeclaration(
      statement,
      wrapper,
      "function",
      "alias",
      name,
      name,
      address,
      address,
      target.visibility,
      true,
      context.identity,
      [this.session.range(statement)],
      context.side,
      undefined,
      context.containerKind,
    );
  }

  private scanModuleFunction(call: Node, context: IRubyScopeContext): void {
    if (context.kind !== "module" || context.side !== "instance") {
      this.problem(
        "ruby-module-function-owner",
        "module_function is only supported in an ordinary module body.",
        "Move the directive into a module or declare singleton methods explicitly.",
        call,
      );
      return;
    }
    const arguments_ = RubySyntax.callArguments(call);
    const wrapped = arguments_[0];
    if (arguments_.length === 1 && wrapped?.type === "method") {
      this.scanMethod(wrapped, call, context, "private", true);
      return;
    }
    if (arguments_.length === 0) {
      context.visibility = "private";
      context.moduleFunction = true;
      return;
    }
    const names = RubySyntax.literalNames(arguments_);
    if (names === undefined || names.length === 0) {
      this.dynamicDirective(call, "module_function");
      return;
    }
    for (const name of names) {
      const candidates = this.methodDeclarations(
        context.identity,
        "instance",
        name,
      ).filter((declaration) => declaration.symbol === "function");
      if (candidates.length !== 1) {
        this.problem(
          "ruby-module-function-target",
          `module_function cannot identify one selected prior method '${name}'.`,
          "Define the method once earlier in the same selected file or use an explicit singleton method.",
          call,
        );
        continue;
      }
      const target = candidates[0];
      if (target === undefined) continue;
      target.visibility = "private";
      this.cloneModuleFunction(target);
    }
  }

  private cloneModuleFunction(target: IRubyDeclaration): void {
    const address = this.memberAddress(
      target.ownerIdentity ?? [],
      "singleton",
      target.runtimeName,
    );
    const clone: IRubyDeclaration = {
      ...target,
      id: `ruby:${this.source.id}:declaration:${this.serial++}:module-function`,
      form: "module-function",
      identity: address,
      address,
      visibility: "public",
      side: "singleton",
      site: structuredClone(target.site),
    };
    this.declarations.push(clone);
    for (const documentation of this.documentation.values())
      for (const attachment of documentation.attachments.filter(
        (candidate) => candidate.declarationId === target.id,
      ))
        documentation.attachments.push({
          declarationId: clone.id,
          siteId: attachment.siteId,
        });
  }

  private changeMethodVisibility(
    ownerIdentity: string[],
    side: RubyMethodSide,
    name: string,
    visibility: RubyVisibility,
    call: Node,
  ): void {
    const candidates = this.methodDeclarations(ownerIdentity, side, name);
    if (candidates.length === 0) {
      this.problem(
        "ruby-visibility-target",
        `Ruby visibility directive cannot identify a selected prior ${side} method '${name}'.`,
        "Define the method earlier in the same selected file or add load-order-aware resolution.",
        call,
      );
      return;
    }
    for (const candidate of candidates) candidate.visibility = visibility;
  }

  private changeConstantVisibility(
    identity: string[],
    visibility: Extract<RubyVisibility, "private" | "public">,
    call: Node,
  ): void {
    const key = this.identityKey(identity);
    const candidates = this.declarations.filter(
      (declaration) =>
        (declaration.form === "class" ||
          declaration.form === "module" ||
          declaration.form === "constant") &&
        this.identityKey(declaration.identity) === key,
    );
    if (candidates.length === 0) {
      this.problem(
        "ruby-constant-visibility-target",
        `Ruby constant visibility cannot identify selected prior constant '${identity.join("::")}'.`,
        "Declare the constant earlier in the same selected file or add load-order-aware resolution.",
        call,
      );
      return;
    }
    this.constantVisibility.set(key, visibility);
    for (const candidate of candidates) candidate.visibility = visibility;
  }

  private methodDeclarations(
    ownerIdentity: string[],
    side: RubyMethodSide,
    runtimeName: string,
  ): IRubyDeclaration[] {
    const owner = this.identityKey(ownerIdentity);
    return this.declarations.filter(
      (declaration) =>
        declaration.definition &&
        declaration.side === side &&
        declaration.runtimeName === runtimeName &&
        this.identityKey(declaration.ownerIdentity ?? []) === owner &&
        (declaration.symbol === "function" || declaration.form === "attribute"),
    );
  }

  private addDeclaration(
    item: Node,
    siteNode: Node,
    symbol: EvidenceProgrammingSymbol,
    form: RubyDeclarationForm,
    name: string,
    runtimeName: string,
    identity: string[],
    address: string[],
    visibility: RubyVisibility,
    definition: boolean,
    ownerIdentity: string[],
    content: IEvidenceSourceRange[],
    side?: RubyMethodSide,
    attributeMode?: RubyAttributeMode,
    containerKind?: RubyContainerKind,
    superclass?: string,
  ): IRubyDeclaration {
    const documentation = this.attachedDocumentation(siteNode);
    const site: IEvidenceUnitSite = {
      id: this.siteId(siteNode),
      file: this.source.physicalPath,
      range: this.text.range(
        documentation?.range?.start?.offset ?? siteNode.startIndex,
        siteNode.endIndex,
      ),
      content,
    };
    const declaration: IRubyDeclaration = {
      id: `ruby:${this.source.id}:declaration:${this.serial++}:${form}:${item.startIndex}`,
      name,
      runtimeName,
      symbol,
      form,
      identity,
      address,
      site,
      visibility,
      definition,
      ...(ownerIdentity.length === 0 ? {} : { ownerIdentity }),
      ...(side === undefined ? {} : { side }),
      ...(attributeMode === undefined ? {} : { attributeMode }),
      ...(containerKind === undefined ? {} : { containerKind }),
      ...(superclass === undefined ? {} : { superclass }),
    };
    this.declarations.push(declaration);
    if (documentation !== undefined)
      this.attach(documentation, declaration.id, site.id);
    return declaration;
  }

  private attachedDocumentation(node: Node): IRubyDocumentation | undefined {
    const documentation = Array.from(this.documentation.values())
      .filter(
        (candidate) =>
          candidate.syntax !== undefined &&
          this.lineLeading(candidate.range) &&
          candidate.range.end.offset <= node.startIndex &&
          (candidate.syntax.opening.startsWith("=begin") ||
            candidate.range.start.column === node.startPosition.column + 1),
      )
      .sort((left, right) => right.range.end.offset - left.range.end.offset)[0];
    if (documentation === undefined) return undefined;
    const between = this.source.content.slice(
      documentation.range.end.offset,
      node.startIndex,
    );
    return between.trim() !== "" || /\r?\n[ \t]*\r?\n/u.test(between)
      ? undefined
      : documentation;
  }

  private lineLeading(range: IEvidenceSourceRange): boolean {
    const lineStart =
      Math.max(
        this.source.content.lastIndexOf("\n", range.start.offset - 1),
        this.source.content.lastIndexOf("\r", range.start.offset - 1),
      ) + 1;
    return (
      this.source.content.slice(lineStart, range.start.offset).trim() === ""
    );
  }

  private collectDocumentation(): void {
    const comments = this.session.root
      .descendantsOfType("comment")
      .sort((left, right) => left.startIndex - right.startIndex);
    for (let index = 0; index < comments.length; ++index) {
      const first = comments[index];
      if (first === undefined) continue;
      const syntax = RubySyntax.commentSyntax(first);
      if (syntax === undefined) continue;
      let last = first;
      if (first.text.startsWith("#"))
        while (index + 1 < comments.length) {
          const next = comments[index + 1];
          if (next === undefined) break;
          const between = this.source.content.slice(
            last.endIndex,
            next.startIndex,
          );
          if (
            !next.text.startsWith("#") ||
            next.startPosition.column !== first.startPosition.column ||
            /\r?\n[ \t]*\r?\n/u.test(between) ||
            between.trim() !== ""
          )
            break;
          last = next;
          ++index;
        }
      this.ensureDocumentationRange(
        this.text.range(first.startIndex, last.endIndex),
        syntax,
      );
    }
  }

  private collectLiteralAnnotations(): void {
    const contents = [
      ...this.session.root.descendantsOfType("string_content"),
      ...this.session.root.descendantsOfType("heredoc_content"),
    ];
    for (const content of contents) {
      if (!this.annotation(content.text)) continue;
      const range = this.session.range(content);
      const id = `ruby:${this.source.id}:documentation:${range.start.offset}:${range.end.offset}`;
      this.documentation.set(id, {
        id,
        range,
        mapping: EvidenceDocumentation.read(this.source.content, id, range, {
          opening: "",
          closing: "",
          tagBoundaries: true,
          allowWithdrawal: false,
        }),
        attachments: [],
      });
    }
  }

  private ensureDocumentationRange(
    range: IEvidenceSourceRange,
    syntax: IEvidenceCommentSyntax,
  ): IRubyDocumentation {
    const key = `${range.start.offset}:${range.end.offset}`;
    let documentation = this.documentation.get(key);
    if (documentation === undefined) {
      documentation = {
        id: `ruby:${this.source.id}:documentation:${key}`,
        range,
        syntax,
        attachments: [],
      };
      this.documentation.set(key, documentation);
    }
    return documentation;
  }

  private attach(
    documentation: IRubyDocumentation,
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

  private containsSurfaceChange(node: Node): boolean {
    const queue: Node[] = [node];
    for (let index = 0; index < queue.length; ++index) {
      const current = queue[index];
      if (current === undefined) continue;
      if (
        current.type === "class" ||
        current.type === "module" ||
        current.type === "singleton_class" ||
        current.type === "method" ||
        current.type === "singleton_method" ||
        current.type === "alias" ||
        current.type === "undef"
      )
        return true;
      if (
        current.type === "assignment" &&
        RubySyntax.constantPath(current.childForFieldName("left")) !== undefined
      )
        return true;
      const callName = RubySyntax.callName(current);
      if (callName !== undefined && this.surfaceCall(callName)) return true;
      queue.push(...current.namedChildren);
    }
    return false;
  }

  private surfaceCall(name: string): boolean {
    return [
      "alias_method",
      "attr",
      "attr_accessor",
      "attr_reader",
      "attr_writer",
      "autoload",
      "class_eval",
      "const_set",
      "define_method",
      "define_singleton_method",
      "extend",
      "include",
      "module_eval",
      "module_function",
      "prepend",
      "private",
      "private_class_method",
      "private_constant",
      "protected",
      "public",
      "public_class_method",
      "public_constant",
      "refine",
      "remove_const",
      "remove_method",
      "undef_method",
      "using",
    ].includes(name);
  }

  private dynamicDirective(node: Node, description: string): void {
    this.problem(
      "ruby-dynamic-directive",
      `Ruby ${description} uses names that cannot be resolved statically.`,
      "Use literal symbol or string names in the selected class or module body.",
      node,
    );
  }

  private resolvePath(
    path: IRubyConstantPath,
    context: IRubyScopeContext,
  ): string[] {
    return path.absolute || context.kind === "top"
      ? path.segments
      : [...context.identity, ...path.segments];
  }

  private resolveOptionalPath(
    path: IRubyConstantPath | undefined,
    context: IRubyScopeContext,
  ): string[] | undefined {
    return path === undefined ? undefined : this.resolvePath(path, context);
  }

  private memberAddress(
    owner: string[],
    side: RubyMethodSide,
    name: string,
  ): string[] {
    return side === "instance" ? [...owner, name] : [...owner, "self", name];
  }

  private identityKey(identity: string[]): string {
    return JSON.stringify(identity);
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
    return `ruby:${this.source.id}:site:${this.nodeKey(node)}`;
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
