import type { Node } from "web-tree-sitter";

import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IRubyConstantPath } from "./IRubyConstantPath";

/** Grammar-specific Ruby helpers without public-surface decisions. */
export namespace RubySyntax {
  export function callName(node: Node): string | undefined {
    if (node.type !== "call") return undefined;
    const method = node.childForFieldName("method");
    return method?.type === "identifier" ? method.text : undefined;
  }

  export function callArguments(node: Node): Node[] {
    if (node.type !== "call") return [];
    return node.childForFieldName("arguments")?.namedChildren ?? [];
  }

  export function hasReceiver(node: Node): boolean {
    return node.type === "call" && node.childForFieldName("receiver") !== null;
  }

  export function methodName(node: Node | null): string | undefined {
    if (node === null) return undefined;
    if (
      node.type === "identifier" ||
      node.type === "constant" ||
      node.type === "operator" ||
      node.type === "setter"
    )
      return node.text;
    return literalName(node);
  }

  export function literalNames(nodes: Node[]): string[] | undefined {
    const output: string[] = [];
    for (const node of nodes) {
      if (node.type === "array") {
        const nested = literalNames(node.namedChildren);
        if (nested === undefined) return undefined;
        output.push(...nested);
        continue;
      }
      const name = literalName(node);
      if (name === undefined) return undefined;
      output.push(name);
    }
    return output;
  }

  export function literalName(node: Node): string | undefined {
    if (node.type === "simple_symbol") return node.text.slice(1);
    if (node.type !== "string" && node.type !== "delimited_symbol")
      return undefined;
    if (
      node.descendantsOfType("interpolation").length !== 0 ||
      node.descendantsOfType("escape_sequence").length !== 0
    )
      return undefined;
    return node.namedChildren
      .filter((child) => child.type === "string_content")
      .map((child) => child.text)
      .join("");
  }

  export function constantPath(
    node: Node | null,
  ): IRubyConstantPath | undefined {
    if (node === null) return undefined;
    if (node.type === "constant")
      return { absolute: false, segments: [node.text] };
    if (node.type !== "scope_resolution") return undefined;
    const name = node.childForFieldName("name");
    if (name?.type !== "constant") return undefined;
    const scope = node.childForFieldName("scope");
    if (scope === null)
      return node.text.startsWith("::")
        ? { absolute: true, segments: [name.text] }
        : undefined;
    const parent = constantPath(scope);
    return parent === undefined
      ? undefined
      : {
          absolute: parent.absolute,
          segments: [...parent.segments, name.text],
        };
  }

  export function commentSyntax(
    node: Node,
  ): IEvidenceCommentSyntax | undefined {
    if (node.type !== "comment") return undefined;
    if (node.text.startsWith("#"))
      return {
        opening: "#",
        closing: "",
        linePrefix: "#",
        tagBoundaries: true,
        allowWithdrawal: true,
      };
    if (!node.text.startsWith("=begin")) return undefined;
    const openingEnd = node.text.indexOf("\n");
    const closingStart = node.text.lastIndexOf("=end");
    if (openingEnd < 0 || closingStart <= openingEnd) return undefined;
    return {
      opening: node.text.slice(0, openingEnd + 1),
      closing: node.text.slice(closingStart),
      tagBoundaries: true,
      allowWithdrawal: true,
    };
  }

  export function superclass(node: Node): string | undefined {
    const superclass = node.childForFieldName("superclass");
    if (superclass === null) return undefined;
    return superclass.text.replace(/^\s*</u, "").replace(/\s+/gu, " ").trim();
  }

  export function generatedConstant(node: Node | null): boolean {
    if (node?.type !== "call") return false;
    const method = callName(node);
    const receiver = node.childForFieldName("receiver");
    const path = constantPath(receiver);
    if (path === undefined) return false;
    const owner = path.segments.join("::");
    return (
      (method === "new" &&
        (owner === "Class" || owner === "Module" || owner === "Struct")) ||
      (method === "define" && owner === "Data")
    );
  }
}
