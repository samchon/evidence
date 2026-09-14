import type { Node } from "web-tree-sitter";

import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";

/**
 * Grammar-specific Java names, packages, modifiers, literals, and Javadoc.
 *
 * Java extraction uses these helpers to interpret parser nodes without resolving
 * compiler symbols, preserving source-spelled ownership and documentation boundaries.
 */
export namespace JavaSyntax {
  export function name(node: Node | null): string | undefined {
    return node !== null && node.type === "identifier" ? node.text : undefined;
  }

  export function path(node: Node | null): string[] | undefined {
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

  export function packagePath(node: Node | undefined): string[] {
    if (node === undefined) return [];
    for (const child of node.namedChildren) {
      const candidate = path(child);
      if (candidate !== undefined) return candidate;
    }
    return [];
  }

  export function parameterName(node: Node): string | undefined {
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

  export function hasModifier(node: Node, modifier: string): boolean {
    const modifiers = node.namedChildren.find(
      (child) => child.type === "modifiers",
    );
    return modifiers === undefined
      ? false
      : modifiers.children.some((child) => child.type === modifier);
  }

  export function javadoc(node: Node): Node | null {
    const previous = node.previousNamedSibling;
    return previous !== null &&
      previous.type === "block_comment" &&
      previous.text.startsWith("/**")
      ? previous
      : null;
  }

  export function comment(node: Node): IEvidenceCommentSyntax {
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

  export function string(node: Node): IEvidenceCommentSyntax | undefined {
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
