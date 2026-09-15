import type { Node as EvidNode } from "web-tree-sitter";

import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";

/**
 * Grammar-specific Java names, packages, modifiers, literals, and Javadoc.
 *
 * Java extraction uses these helpers to interpret parser nodes without
 * resolving compiler symbols, preserving source-spelled ownership and
 * documentation boundaries.
 */
export namespace EvidJavaSyntax {
  export function name(node: EvidNode | null): string | undefined {
    return node !== null && node.type === "identifier" ? node.text : undefined;
  }

  export function path(node: EvidNode | null): string[] | undefined {
    if (node === null) return undefined;
    const direct = name(node);
    if (direct !== undefined) return [direct];
    if (node.type !== "scoped_identifier") return undefined;
    const scope = path(node.childForFieldName("scope"));
    const suffix = name(node.childForFieldName("name"));
    return scope === undefined || suffix === undefined
      ? undefined
      : [...scope, suffix];
  }

  export function packagePath(node: EvidNode | undefined): string[] {
    if (node === undefined) return [];
    for (const child of node.namedChildren) {
      const candidate = path(child);
      if (candidate !== undefined) return candidate;
    }
    return [];
  }

  export function parameterName(node: EvidNode): string | undefined {
    if (node.type === "formal_parameter")
      return name(node.childForFieldName("name"));
    if (node.type !== "spread_parameter") return undefined;
    const declarator = node.namedChildren.find(
      (child) => child.type === "variable_declarator",
    );
    return declarator === undefined
      ? undefined
      : name(declarator.childForFieldName("name"));
  }

  export function hasModifier(node: EvidNode, modifier: string): boolean {
    const modifiers = node.namedChildren.find(
      (child) => child.type === "modifiers",
    );
    return modifiers === undefined
      ? false
      : modifiers.children.some((child) => child.type === modifier);
  }

  export function javadoc(node: EvidNode): EvidNode | null {
    const previous = node.previousNamedSibling;
    return previous !== null &&
      previous.type === "block_comment" &&
      previous.text.startsWith("/**")
      ? previous
      : null;
  }

  export function comment(node: EvidNode): IEvidCommentSyntax {
    if (node.type === "line_comment")
      return {
        opening: "//",
        closing: "",
        linePrefix: "//",
        tagBoundaries: true,
        allowWithdrawal: false,
      };
    const javadoc = node.text.startsWith("/**");
    return {
      opening: javadoc ? "/**" : "/*",
      closing: "*/",
      tagBoundaries: true,
      allowWithdrawal: javadoc,
      ...(javadoc ? { linePrefix: "*" } : {}),
    };
  }

  export function string(node: EvidNode): IEvidCommentSyntax | undefined {
    if (node.type !== "string_literal") return undefined;
    const delimiter = node.text.startsWith('"""') ? '"""' : '"';
    return {
      opening: delimiter,
      closing: delimiter,
      tagBoundaries: true,
      allowWithdrawal: false,
    };
  }
}
