import { posix } from "node:path";
import type { Node } from "web-tree-sitter";

import { SourceText } from "../../internal/SourceText";
import type { EvidenceParseSession } from "../../parsers/EvidenceParseSession";
import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { IMatlabDeclaration } from "./IMatlabDeclaration";
import type { IMatlabDocumentation } from "./IMatlabDocumentation";
import type { IMatlabFileAnalysis } from "./IMatlabFileAnalysis";

/** Extracts declared MATLAB surfaces without evaluating application code. */
export class MatlabFileScanner {
  /** Serializable declarations including private ownership boundaries. */
  private readonly declarations: IMatlabDeclaration[] = [];

  /** Only language-defined attached help carriers. */
  private readonly documentation: IMatlabDocumentation[] = [];

  /** Surface failures retained in incomplete inventories. */
  private readonly diagnostics: IEvidenceDiagnostic[] = [];

  /** Physical path normalized independently of the host operating system. */
  private readonly file: string;

  /** Package-folder identity segments. */
  private readonly packages: string[];

  /** Original UTF-16 source mapper. */
  private readonly text: SourceText;

  /** Borrows a live syntax tree only during extraction. */
  public constructor(
    private readonly session: EvidenceParseSession,
    private readonly source: IEvidenceSourceFile,
  ) {
    this.file = source.physicalPath.replaceAll("\\", "/");
    this.packages = this.file
      .split("/")
      .filter((part) => part.startsWith("+"))
      .map((part) => part.slice(1));
    this.text = new SourceText(source.content);
  }

  /** Selects the primary declaration and recognizes dynamic-source boundaries. */
  public scan(): IMatlabFileAnalysis {
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
      if (
        [
          "addprop",
          "addpath",
          "rmpath",
          "path",
          "eval",
          "evalin",
          "assignin",
          "class",
          "schema",
          "feval",
          "str2func",
        ].includes(name) ||
        name.endsWith(".addprop")
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

  /** Maps explicit class members and independent read/write visibility. */
  private members(block: Node, owner: IMatlabDeclaration): void {
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

  /** Reads known static class metadata and rejects unknown surface-changing attributes. */
  private attributes(node: Node): Map<string, string> {
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

  /** Creates a site before attaching the appropriate MATLAB help placement. */
  private add(
    node: Node,
    nameNode: Node | null,
    symbol: EvidenceProgrammingSymbol,
    owner: IMatlabDeclaration | undefined,
    visible: boolean,
  ): IMatlabDeclaration | undefined {
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
    const declaration: IMatlabDeclaration = {
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

  /** Rejects source names that depend on MATLAB runtime name shadowing. */
  private filename(declaration: IMatlabDeclaration, node: Node): void {
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

  /** Attaches post-signature class/function help and preceding-or-inline member help. */
  private attach(node: Node, declaration: IMatlabDeclaration): void {
    const after =
      node.type === "class_definition" || node.type === "function_definition";
    let comments: Node[] = [];
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
        /^[ \t]*\r?\n[ \t]*$/u.test(
          this.source.content.slice(previous.endIndex, node.startIndex),
        ) &&
        this.lineStart(previous)
      ) {
        comments = [previous];
        let before = previous.previousNamedSibling;
        while (
          before?.type === "comment" &&
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

  /** Distinguishes standalone help lines from a preceding property's inline help. */
  private lineStart(node: Node): boolean {
    const start =
      this.source.content.lastIndexOf("\n", node.startIndex - 1) + 1;
    return /^[ \t]*$/u.test(this.source.content.slice(start, node.startIndex));
  }

  /** Preserves unsupported source constructs as actionable incomplete analysis. */
  private problem(code: string, message: string, node: Node): void {
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
