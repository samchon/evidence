import { posix } from "node:path";
import type { EvidNode } from "web-tree-sitter";

import { EvidSourceText } from "../../internal/EvidSourceText";
import type { EvidParseSession } from "../../parsers/EvidParseSession";
import type { IEvidDiagnostic } from "../../structures/IEvidDiagnostic";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";
import type { IEvidMatlabDeclaration } from "./IEvidMatlabDeclaration";
import type { IEvidMatlabDocumentation } from "./IEvidMatlabDocumentation";
import type { IEvidMatlabFileAnalysis } from "./IEvidMatlabFileAnalysis";

/**
 * Extracts declared MATLAB surfaces without evaluating application code.
 *
 * The scanner keeps class-folder facts, external signatures, and property
 * accessors separate because their public owner may be established in another file.
 */
export class EvidMatlabFileScanner {
  /**
   * Serializable declarations including private ownership boundaries.
   *
   * `scan` returns this ordered collection to the adapter, which reconciles
   * public visibility and external owners before materializing Evid units.
   */
  private readonly declarations: IEvidMatlabDeclaration[] = [];

  /**
   * Language-defined help carriers eligible for later attachment.
   *
   * The scanner records only placements MATLAB defines as help, allowing the
   * adapter to reject annotation-looking text at unsupported positions.
   */
  private readonly documentation: IEvidMatlabDocumentation[] = [];

  /**
   * Surface failures retained in incomplete inventories.
   *
   * Unsupported dynamic or ambiguous constructs append diagnostics here so a
   * scan cannot silently shrink the graph population into a passing result.
   */
  private readonly diagnostics: IEvidDiagnostic[] = [];

  /**
   * Physical path normalized independently of the host operating system.
   *
   * Ownership and package-folder lookup use this slash-normalized path so
   * MATLAB identities remain stable across Windows and POSIX hosts.
   */
  private readonly file: string;

  /**
   * Package-folder identity segments extracted from the physical path.
   *
   * Declared names include these `+` folder segments when the scanner constructs
   * a MATLAB public address for a class, function, or member.
   */
  private readonly packages: string[];

  /**
   * Original UTF-16 source mapper for this source snapshot.
   *
   * Scanner ranges are translated through this object so sites and diagnostics
   * use the shared one-based coordinate contract for the original content.
   */
  private readonly text: EvidSourceText;

  /**
   * Borrows a live syntax tree only during extraction.
   *
   * The constructor normalizes the source path and derives package segments once,
   * so later ownership reconciliation has platform-independent physical identity.
   */
  public constructor(
    private readonly session: EvidParseSession,
    private readonly source: IEvidSourceFile,
  ) {
    this.file = source.physicalPath.replaceAll("\\", "/");
    this.packages = this.file
      .split("/")
      .filter((part) => part.startsWith("+"))
      .map((part) => part.slice(1));
    this.text = new EvidSourceText(source.content);
  }

  /**
   * Selects the primary declaration and recognizes dynamic-source boundaries.
   *
   * MATLAB file layout determines ownership, so unsupported leading forms become
   * diagnostics instead of being skipped and shrinking the public population.
   */
  public scan(): IEvidMatlabFileAnalysis {
    const nodes = this.session.root.namedChildren.filter(
      (node) => node.type !== "comment" && node.type !== "line_continuation",
    );
    const primary = nodes[0];
    if (primary?.type === "class_definition") {
      const owner = this.add(
        primary,
        primary.childForFieldName("name"),
        "type",
        undefined,
        true,
      );
      if (owner !== undefined) {
        this.attributes(primary);
        this.filename(owner, primary);
        const bases = primary.namedChildren.find(
          (node) => node.type === "superclasses",
        );
        if (
          bases !== undefined &&
          bases
            .descendantsOfType("property_name")
            .some((node) => node.text === "dynamicprops")
        )
          this.problem(
            "dynamic-surface",
            "A dynamicprops superclass permits runtime-created properties.",
            bases,
          );
        for (const block of primary.namedChildren) {
          if (
            ["properties", "methods", "enumeration", "events"].includes(
              block.type,
            )
          )
            this.members(block, owner);
          else if (
            ![
              "identifier",
              "attributes",
              "superclasses",
              "comment",
              "line_continuation",
            ].includes(block.type)
          )
            this.problem(
              "source-form",
              `Unsupported class declaration form '${block.type}'.`,
              block,
            );
        }
      }
    } else if (primary?.type === "function_definition") {
      const ownerFolder = posix.basename(posix.dirname(this.file));
      const declaration = this.add(
        primary,
        primary.childForFieldName("name"),
        "function",
        undefined,
        true,
      );
      if (declaration !== undefined) {
        this.filename(declaration, primary);
        if (ownerFolder.startsWith("@")) {
          declaration.externalOwner = posix.join(
            posix.dirname(this.file),
            `${ownerFolder.slice(1)}.m`,
          );
        }
      }
    } else if (primary !== undefined)
      this.problem(
        "script",
        "Executable script files have no statically declared primary function surface.",
        primary,
      );
    for (const node of nodes.slice(1))
      if (node.type !== "function_definition")
        this.problem(
          "source-form",
          "Only file-local functions may follow a primary declaration.",
          node,
        );
    for (const node of this.session.root.descendantsOfType([
      "function_call",
      "command",
      "handle_operator",
    ])) {
      const name =
        node.childForFieldName("name")?.text ??
        node.namedChildren[0]?.text ??
        "";
      if (node.type === "command" && name === "endfunction")
        this.problem(
          "octave",
          "Octave endfunction is outside configured MATLAB syntax.",
          node,
        );
      const argumentsNode = node.namedChildren.find(
        (child) => child.type === "arguments",
      );
      const legacyClass =
        name === "class" &&
        (node.type === "command"
          ? node.namedChildren.filter(
              (child) => child.type === "command_argument",
            ).length > 1
          : argumentsNode !== undefined &&
            argumentsNode.namedChildren.length > 1);
      if (
        [
          "addprop",
          "addpath",
          "rmpath",
          "path",
          "eval",
          "evalin",
          "assignin",
          "schema",
          "feval",
          "str2func",
        ].includes(name) ||
        name.endsWith(".addprop") ||
        legacyClass
      )
        this.problem(
          "dynamic-surface",
          `Call '${name}' can alter or conceal the declared surface and requires runtime analysis.`,
          node,
        );
    }
    for (const node of this.session.root.descendantsOfType(
      "function_definition",
    ))
      if (node.children.some((child) => child.text === "endfunction"))
        this.problem(
          "octave",
          "Octave endfunction is outside configured MATLAB syntax.",
          node,
        );
    return {
      source: this.source,
      declarations: this.declarations,
      documentation: this.documentation,
      diagnostics: this.diagnostics,
      complete: this.diagnostics.length === 0,
    };
  }

  /**
   * Maps explicit class members and independent read/write visibility.
   *
   * MATLAB property access can make either accessor public, so this phase records
   * the combined public surface without treating a private accessor as a new unit.
   */
  private members(block: EvidNode, owner: IEvidMatlabDeclaration): void {
    const attributes = this.attributes(block);
    const access = attributes.get("Access") ?? "public";
    const getPublic = (attributes.get("GetAccess") ?? access) === "public";
    const setPublic = (attributes.get("SetAccess") ?? access) === "public";
    const eventPublic =
      (attributes.get("ListenAccess") ?? access) === "public" ||
      (attributes.get("NotifyAccess") ?? access) === "public";
    for (const node of block.namedChildren) {
      if (["attributes", "comment", "line_continuation"].includes(node.type))
        continue;
      const method =
        node.type === "function_definition" ||
        node.type === "function_signature";
      const property =
        node.type === "property" ||
        node.type === "enum" ||
        (block.type === "events" && node.type === "identifier");
      if (!method && !property) {
        this.problem(
          "source-form",
          `Unsupported member form '${node.type}'.`,
          node,
        );
        continue;
      }
      const accessor = node.children.find(
        (child) => child.text === "get." || child.text === "set.",
      )?.text;
      const name =
        node.childForFieldName("name") ??
        (node.type === "identifier" ? node : (node.namedChildren[0] ?? null));
      const declaration = this.add(
        node,
        name,
        method && accessor === undefined ? "function" : "property",
        owner,
        owner.public &&
          (method
            ? access === "public"
            : block.type === "properties"
              ? getPublic || setPublic
              : block.type === "events"
                ? eventPublic
                : true),
      );
      if (declaration === undefined) continue;
      const attributesNode = block.namedChildren.find(
        (child) => child.type === "attributes",
      );
      if (attributesNode !== undefined) {
        const attributesRange = this.session.range(attributesNode);
        declaration.site.range = {
          start: attributesRange.start,
          end: declaration.site.range.end,
        };
        declaration.site.content.unshift(attributesRange);
      }
      if (node.type === "property") {
        declaration.getPublic = getPublic;
        declaration.setPublic = setPublic;
      }
      if (accessor !== undefined) {
        declaration.accessor = accessor === "get." ? "get" : "set";
      }
      if (
        node.type === "function_signature" &&
        attributes.get("Abstract") !== "true"
      ) {
        declaration.implementation = posix.join(
          posix.dirname(this.file),
          `${declaration.name}.m`,
        );
        if (!posix.basename(posix.dirname(this.file)).startsWith("@"))
          this.problem(
            "external-method",
            "Nonabstract method prototypes require a classdef file in its @Class folder and selected method files.",
            node,
          );
      }
    }
  }

  /**
   * Reads known static class metadata and rejects unknown surface-changing attributes.
   *
   * Attribute interpretation controls visibility and ownership; unsupported
   * attributes become incomplete-analysis diagnostics instead of guessed policy.
   */
  private attributes(node: EvidNode): Map<string, string> {
    const result = new Map<string, string>();
    const attributes = node.namedChildren.find(
      (child) => child.type === "attributes",
    );
    for (const attribute of attributes?.namedChildren ?? []) {
      const nameNode = attribute.namedChildren[0];
      const name =
        nameNode?.type === "not_operator"
          ? nameNode.namedChildren[0]?.text
          : nameNode?.text;
      if (name === undefined) continue;
      const valueNode = attribute.namedChildren[1];
      const value =
        valueNode === undefined
          ? nameNode?.type === "not_operator"
            ? "false"
            : "true"
          : valueNode.text.replace(/^['"]|['"]$/gu, "");
      if (
        ![
          "Access",
          "GetAccess",
          "SetAccess",
          "ListenAccess",
          "NotifyAccess",
          "Static",
          "Constant",
          "Dependent",
          "Abstract",
          "Hidden",
          "Sealed",
          "Transient",
          "NonCopyable",
          "AbortSet",
          "GetObservable",
          "SetObservable",
          "ConstructOnLoad",
          "HandleCompatible",
          "InferiorClasses",
          "AllowedSubclasses",
          "RestrictsSubclassing",
        ].includes(name)
      )
        this.problem(
          "attribute",
          `Attribute '${name}' has no established static visibility semantics.`,
          attribute,
        );
      if (
        /Access$/u.test(name) &&
        !["public", "private", "protected", "immutable"].includes(value)
      ) {
        const friends =
          value.startsWith("{") && value.endsWith("}")
            ? value
                .slice(1, -1)
                .trim()
                .split(/[,\s]+/u)
            : [value];
        if (
          !friends.every((friend) => /^\?[A-Za-z][A-Za-z0-9_.]*$/u.test(friend))
        )
          this.problem(
            "attribute",
            `Access attribute '${name}' is not a static access designation.`,
            attribute,
          );
      } else if (
        !/Access$/u.test(name) &&
        !["InferiorClasses", "AllowedSubclasses"].includes(name) &&
        !["true", "false"].includes(value)
      )
        this.problem(
          "attribute",
          `Attribute '${name}' requires a literal logical value.`,
          attribute,
        );
      result.set(name, value);
    }
    return result;
  }

  /**
   * Creates a declaration site before attaching the appropriate MATLAB help placement.
   *
   * Separating site creation from documentation attachment keeps physical content
   * ownership intact when help belongs after a signature or beside a member.
   */
  private add(
    node: EvidNode,
    nameNode: EvidNode | null,
    symbol: EvidProgrammingSymbol,
    owner: IEvidMatlabDeclaration | undefined,
    visible: boolean,
  ): IEvidMatlabDeclaration | undefined {
    if (nameNode === null || !/^[A-Za-z][A-Za-z0-9_]*$/u.test(nameNode.text)) {
      this.problem(
        "declaration-name",
        "A declaration has no supported literal MATLAB identifier.",
        node,
      );
      return undefined;
    }
    const name = nameNode.text;
    const address = [...(owner?.address ?? this.packages), name];
    const range = this.session.range(node);
    const id = `matlab:${this.source.id}:site:${node.startIndex}:${node.endIndex}`;
    const declaration: IEvidMatlabDeclaration = {
      id,
      name,
      symbol,
      identity: address,
      address,
      anchor: this.file,
      public: visible && !this.file.split("/").includes("private"),
      site: { id, file: this.source.physicalPath, range, content: [range] },
      ...(owner === undefined ? {} : { ownerDeclarationId: owner.id }),
    };
    this.declarations.push(declaration);
    this.attach(node, declaration);
    return declaration;
  }

  /**
   * Rejects source names that depend on MATLAB runtime name shadowing.
   *
   * The static inventory cannot determine which shadowed function MATLAB will
   * invoke, so the scanner preserves this ambiguity as an actionable diagnostic.
   */
  private filename(declaration: IEvidMatlabDeclaration, node: EvidNode): void {
    if (posix.basename(this.file, ".m") !== declaration.name)
      this.problem(
        "filename",
        "The primary declaration name must match its selected .m file name; runtime name shadowing is not resolved.",
        node,
      );
    const folder = posix.basename(posix.dirname(this.file));
    if (
      declaration.symbol === "type" &&
      folder.startsWith("@") &&
      folder.slice(1) !== declaration.name
    )
      this.problem(
        "class-folder",
        "The classdef name must match its @Class folder.",
        node,
      );
  }

  /**
   * Attaches post-signature class/function help and preceding-or-inline member help.
   *
   * MATLAB placement rules differ by declaration form; this method records only
   * eligible carriers and leaves unsupported nearby comments visible for diagnostics.
   */
  private attach(node: EvidNode, declaration: IEvidMatlabDeclaration): void {
    const after =
      node.type === "class_definition" || node.type === "function_definition";
    let comments: EvidNode[] = [];
    if (after) {
      const name = node.childForFieldName("name");
      const lastHeader =
        node.namedChildren
          .filter(
            (child) =>
              [
                "identifier",
                "function_output",
                "function_arguments",
                "attributes",
                "superclasses",
              ].includes(child.type) &&
              child.startIndex <=
                (node.namedChildren.find(
                  (child) => child.type === "comment" || child.type === "block",
                )?.startIndex ?? node.endIndex),
          )
          .at(-1) ?? name;
      if (lastHeader !== null && lastHeader !== undefined) {
        const candidate = node.namedChildren.find(
          (child) =>
            child.type === "comment" && child.startIndex >= lastHeader.endIndex,
        );
        if (
          candidate !== undefined &&
          /^[ \t]*[\r\n]+[ \t]*$/u.test(
            this.source.content.slice(
              lastHeader.endIndex,
              candidate.startIndex,
            ),
          )
        )
          comments = [candidate];
      }
    } else {
      const previous = node.previousNamedSibling;
      if (
        previous?.type === "comment" &&
        !previous.text.startsWith("%{") &&
        /^[ \t]*\r?\n[ \t]*$/u.test(
          this.source.content.slice(previous.endIndex, node.startIndex),
        ) &&
        this.lineStart(previous)
      ) {
        comments = [previous];
        let before = previous.previousNamedSibling;
        while (
          before?.type === "comment" &&
          !before.text.startsWith("%{") &&
          this.lineStart(before) &&
          /^[ \t]*\r?\n[ \t]*$/u.test(
            this.source.content.slice(before.endIndex, comments[0]?.startIndex),
          )
        ) {
          comments.unshift(before);
          before = before.previousNamedSibling;
        }
      } else {
        const next = node.nextNamedSibling;
        if (
          next?.type === "comment" &&
          /^[ \t]*$/u.test(
            this.source.content.slice(node.endIndex, next.startIndex),
          )
        )
          comments = [next];
      }
    }
    if (comments.length === 0) return;
    let last = comments.at(-1);
    if (after)
      while (
        last?.nextNamedSibling?.type === "comment" &&
        /^[ \t]*\r?\n[ \t]*$/u.test(
          this.source.content.slice(
            last.endIndex,
            last.nextNamedSibling.startIndex,
          ),
        )
      ) {
        comments.push(last.nextNamedSibling);
        last = comments.at(-1);
      }
    const first = comments[0];
    if (first === undefined || last === undefined) return;
    // MATLAB help uses percent lines; block comments remain ordinary inert source.
    if (first.text.startsWith("%{")) return;
    else {
      const blockIndex = comments.findIndex((comment) =>
        comment.text.startsWith("%{"),
      );
      if (blockIndex > 0) last = comments[blockIndex - 1] ?? first;
    }
    const range = this.text.range(first.startIndex, last.endIndex);
    this.documentation.push({
      id: `${declaration.id}:documentation:${first.startIndex}`,
      range,
      syntax: {
        opening: "%",
        closing: "",
        linePrefix: "%",
        tagBoundaries: true,
        allowWithdrawal: true,
      },
      attachments: [
        { declarationId: declaration.id, siteId: declaration.site.id },
      ],
    });
  }

  /**
   * Distinguishes standalone help lines from a preceding property's inline help.
   *
   * Property declarations can carry MATLAB help on the same physical line, so
   * attachment needs this boundary before it creates a documentation range.
   */
  private lineStart(node: EvidNode): boolean {
    const start =
      this.source.content.lastIndexOf("\n", node.startIndex - 1) + 1;
    return /^[ \t]*$/u.test(this.source.content.slice(start, node.startIndex));
  }

  /**
   * Preserves unsupported source constructs as actionable incomplete analysis.
   *
   * Each diagnostic records the source range and failure code, ensuring callers
   * see a failed population rather than an inventory missing uncertain members.
   */
  private problem(code: string, message: string, node: EvidNode): void {
    this.diagnostics.push({
      code: `matlab-${code}`,
      severity: "error",
      message,
      repair:
        "Select static MATLAB classdef/function sources and their ownership files, or implement the unsupported construct before checking coverage.",
      location: {
        file: this.source.physicalPath,
        range: this.session.range(node),
      },
    });
  }
}
