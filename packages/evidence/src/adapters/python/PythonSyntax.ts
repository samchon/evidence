import type { Node } from "web-tree-sitter";

import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";

/** Grammar-specific Python syntax helpers without semantic export decisions. */
export namespace PythonSyntax {
  export function definition(node: Node): Node {
    return node.type === "decorated_definition"
      ? (node.childForFieldName("definition") ?? node)
      : node;
  }

  export function name(node: Node | null): string | undefined {
    return node?.type === "identifier" ? node.text : undefined;
  }

  export function typeAliasName(node: Node): string | undefined {
    const left = node.childForFieldName("left");
    if (left === null) return undefined;
    return left.descendantsOfType("identifier")[0]?.text;
  }

  export function assignmentName(node: Node): string | undefined {
    return name(node.childForFieldName("left"));
  }

  export function decoratorNames(wrapper: Node): string[] {
    if (wrapper.type !== "decorated_definition") return [];
    return wrapper.namedChildren
      .filter((child) => child.type === "decorator")
      .flatMap((decorator) => {
        const expression = decorator.namedChildren[0];
        const value = qualified(expression);
        return value === undefined ? [] : [value];
      });
  }

  export function parameterName(node: Node): string | undefined {
    const parameters = node.childForFieldName("parameters");
    if (parameters === null) return undefined;
    const first = parameters.namedChildren[0];
    if (first === undefined) return undefined;
    if (first.type === "identifier") return first.text;
    return first.descendantsOfType("identifier")[0]?.text;
  }

  export function attributeObject(node: Node): string | undefined {
    if (node.type !== "attribute") return undefined;
    return name(node.childForFieldName("object"));
  }

  export function attributeName(node: Node): string | undefined {
    if (node.type !== "attribute") return undefined;
    return name(node.childForFieldName("attribute"));
  }

  export function stringSyntax(node: Node): IEvidenceCommentSyntax | undefined {
    if (
      node.type !== "string" ||
      node.descendantsOfType("interpolation").length !== 0
    )
      return undefined;
    const opening = node.namedChildren.find(
      (child) => child.type === "string_start",
    )?.text;
    const closing = node.namedChildren.find(
      (child) => child.type === "string_end",
    )?.text;
    if (opening === undefined || closing === undefined) return undefined;
    return {
      opening,
      closing,
      tagBoundaries: true,
      allowWithdrawal: true,
    };
  }

  export function commentSyntax(): IEvidenceCommentSyntax {
    return {
      opening: "#",
      closing: "",
      linePrefix: "#",
      tagBoundaries: true,
      allowWithdrawal: true,
    };
  }

  export function literalSequence(node: Node | null): string[] | undefined {
    if (node === null) return undefined;
    if (node.type === "parenthesized_expression")
      return literalSequence(node.namedChildren[0] ?? null);
    if (node.type === "binary_operator") {
      if (!node.children.some((child) => child.type === "+")) return undefined;
      const left = literalSequence(node.childForFieldName("left"));
      const right = literalSequence(node.childForFieldName("right"));
      return left === undefined || right === undefined
        ? undefined
        : [...left, ...right];
    }
    if (node.type !== "list" && node.type !== "tuple") return undefined;
    const output: string[] = [];
    for (const child of node.namedChildren) {
      const value = literalString(child);
      if (value === undefined) return undefined;
      output.push(value);
    }
    return output;
  }

  export function literalString(node: Node): string | undefined {
    const syntax = stringSyntax(node);
    if (syntax === undefined) return undefined;
    const quote = /(?:'''|"""|'|")$/u.exec(syntax.opening)?.[0];
    if (quote === undefined || syntax.closing !== quote) return undefined;
    const prefix = syntax.opening.slice(0, -quote.length);
    if (prefix !== "" && prefix !== "u" && prefix !== "U") return undefined;
    const value = node.text.slice(
      syntax.opening.length,
      node.text.length - syntax.closing.length,
    );
    return value.includes("\\") || value.includes("\n") || value.includes("\r")
      ? undefined
      : value;
  }

  export function docstring(body: Node | null): Node | undefined {
    if (body === null) return undefined;
    const statement = body.namedChildren.find(
      (child) => child.type !== "comment",
    );
    if (statement?.type !== "expression_statement") return undefined;
    const value = statement.namedChildren[0];
    return value !== undefined && docstringParts(value) !== undefined
      ? value
      : undefined;
  }

  export function docstringParts(node: Node): Node[] | undefined {
    const strings =
      node.type === "string"
        ? [node]
        : node.type === "concatenated_string"
          ? node.namedChildren
          : undefined;
    if (
      strings === undefined ||
      strings.length === 0 ||
      strings.some((string) => !docstringLiteral(string))
    )
      return undefined;
    return strings;
  }

  export function typeAliasAnnotation(node: Node): boolean {
    const annotation = node.childForFieldName("type")?.text;
    return (
      annotation === "TypeAlias" ||
      (annotation !== undefined && annotation.endsWith(".TypeAlias"))
    );
  }

  function qualified(node: Node | undefined): string | undefined {
    if (node === undefined) return undefined;
    if (node.type === "identifier") return node.text;
    if (node.type === "attribute") {
      const object = qualified(node.childForFieldName("object") ?? undefined);
      const attribute = name(node.childForFieldName("attribute"));
      return object === undefined || attribute === undefined
        ? undefined
        : `${object}.${attribute}`;
    }
    if (node.type === "call")
      return qualified(node.childForFieldName("function") ?? undefined);
    if (node.type === "parenthesized_expression")
      return qualified(node.namedChildren[0]);
    return undefined;
  }

  function docstringLiteral(node: Node): boolean {
    const syntax = stringSyntax(node);
    if (syntax === undefined) return false;
    const quote = /(?:'''|"""|'|")$/u.exec(syntax.opening)?.[0];
    if (quote === undefined) return false;
    const prefix = syntax.opening.slice(0, -quote.length).toLowerCase();
    return !prefix.includes("b") && !prefix.includes("f");
  }
}
