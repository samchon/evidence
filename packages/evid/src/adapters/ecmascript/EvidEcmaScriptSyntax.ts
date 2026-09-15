import type { EvidNode } from "web-tree-sitter";

import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";

/**
 * Tree-sitter spelling checks shared by TypeScript and JavaScript extraction.
 *
 * The scanner uses these narrow syntax helpers to preserve literal names,
 * bindings, comments, and supported static module forms without compiler evaluation.
 */
export namespace EvidEcmaScriptSyntax {
  export function token(node: EvidNode, value: string): boolean {
    return node.children.some(
      (child) => !child.isNamed && child.type === value,
    );
  }

  export function name(node: EvidNode | null): string | undefined {
    if (node === null) return undefined;
    switch (node.type) {
      case "identifier":
      case "property_identifier":
      case "shorthand_property_identifier_pattern":
      case "type_identifier":
        return node.text;
      case "number":
        return numeric(node.text);
      case "string":
        return string(node.text);
      default:
        return undefined;
    }
  }

  export function qualifiedName(node: EvidNode | null): string[] {
    if (node === null) return [];
    const direct = name(node);
    if (direct !== undefined) return [direct];
    if (node.type !== "nested_identifier") return [];
    return node.namedChildren.flatMap(qualifiedName);
  }

  export function modifier(node: EvidNode, value: string): boolean {
    return node.children.some(
      (child) =>
        child.type === value ||
        (child.type === "accessibility_modifier" && child.text === value),
    );
  }

  export function publicMember(node: EvidNode): boolean {
    const member = memberName(node);
    return (
      member !== undefined &&
      !modifier(node, "private") &&
      !modifier(node, "protected") &&
      !modifier(node, "accessor")
    );
  }

  export function memberName(node: EvidNode): string | undefined {
    return name(
      node.childForFieldName("name") ??
        node.childForFieldName("pattern") ??
        node.childForFieldName("property"),
    );
  }

  export function specifierName(node: EvidNode): string | undefined {
    const named = name(node.childForFieldName("name"));
    if (named !== undefined) return named;
    return token(node, "default") ? "default" : undefined;
  }

  export function specifierAlias(node: EvidNode): string | undefined {
    const alias = name(node.childForFieldName("alias"));
    if (alias !== undefined) return alias;
    const source = name(node.childForFieldName("name"));
    return source !== undefined && token(node, "default") ? "default" : source;
  }

  export function functionValue(node: EvidNode | null): boolean {
    let current = node;
    while (current !== null) {
      if (
        current.type === "arrow_function" ||
        current.type === "function_expression" ||
        current.type === "generator_function"
      )
        return true;
      if (
        current.type !== "parenthesized_expression" &&
        current.type !== "as_expression" &&
        current.type !== "satisfies_expression" &&
        current.type !== "non_null_expression" &&
        current.type !== "type_assertion"
      )
        return false;
      current =
        current.type === "type_assertion"
          ? (current.namedChildren.at(-1) ?? null)
          : (current.childForFieldName("expression") ??
            current.childForFieldName("value") ??
            current.namedChildren[0] ??
            null);
    }
    return false;
  }

  export function functionType(node: EvidNode | null): boolean {
    let current = node;
    if (current?.type === "type_annotation")
      current = current.namedChildren[0] ?? null;
    while (current?.type === "parenthesized_type")
      current = current.namedChildren[0] ?? null;
    return current?.type === "function_type";
  }

  export function comment(node: EvidNode): IEvidCommentSyntax {
    if (node.text.startsWith("//"))
      return {
        opening: "//",
        closing: "",
        tagBoundaries: true,
        allowWithdrawal: false,
      };
    if (node.text.startsWith("/**"))
      return {
        opening: "/**",
        closing: "*/",
        linePrefix: "*",
        tagBoundaries: true,
        allowWithdrawal: true,
      };
    return {
      opening: "/*",
      closing: "*/",
      linePrefix: "*",
      tagBoundaries: true,
      allowWithdrawal: false,
    };
  }

  export function jsdoc(node: EvidNode): boolean {
    return node.type === "comment" && node.text.startsWith("/**");
  }

  export function module(source: EvidNode | null): string | undefined {
    if (source === null || source.type !== "string") return undefined;
    return string(source.text);
  }

  export function bindings(pattern: EvidNode | null): EvidNode[] {
    if (pattern === null) return [];
    switch (pattern.type) {
      case "identifier":
      case "shorthand_property_identifier_pattern":
        return [pattern];
      case "assignment_pattern":
      case "rest_pattern":
        return bindings(
          pattern.childForFieldName("left") ?? pattern.namedChildren[0] ?? null,
        );
      case "object_pattern":
      case "array_pattern":
        return pattern.namedChildren.flatMap((child) => {
          if (child.type === "pair_pattern")
            return bindings(
              child.childForFieldName("value") ??
                child.namedChildren.at(-1) ??
                null,
            );
          return bindings(child);
        });
      default:
        return [];
    }
  }

  function string(text: string): string | undefined {
    if (text.length < 2) return undefined;
    const quote = text[0];
    if ((quote !== '"' && quote !== "'") || text.at(-1) !== quote)
      return undefined;
    let output = "";
    for (let index = 1; index < text.length - 1; ++index) {
      const character = text[index];
      if (character !== "\\") {
        output += character ?? "";
        continue;
      }
      const escaped = text[++index];
      if (escaped === undefined) return undefined;
      switch (escaped) {
        case "n":
          output += "\n";
          break;
        case "r":
          output += "\r";
          break;
        case "t":
          output += "\t";
          break;
        case "b":
          output += "\b";
          break;
        case "f":
          output += "\f";
          break;
        case "v":
          output += "\v";
          break;
        case "0":
          output += "\0";
          break;
        case "x": {
          const value = hexadecimal(text, index + 1, 2);
          if (value === undefined) return undefined;
          output += String.fromCharCode(value);
          index += 2;
          break;
        }
        case "u": {
          if (text[index + 1] === "{") {
            const closing = text.indexOf("}", index + 2);
            if (closing === -1) return undefined;
            const digits = text.slice(index + 2, closing);
            if (!/^[0-9a-fA-F]{1,6}$/u.test(digits)) return undefined;
            const value = Number.parseInt(digits, 16);
            if (value > 0x10ffff) return undefined;
            output += String.fromCodePoint(value);
            index = closing;
          } else {
            const value = hexadecimal(text, index + 1, 4);
            if (value === undefined) return undefined;
            output += String.fromCharCode(value);
            index += 4;
          }
          break;
        }
        case "\n":
          break;
        case "\r":
          if (text[index + 1] === "\n") ++index;
          break;
        default:
          output += escaped;
      }
    }
    return output;
  }

  function numeric(text: string): string {
    const compact = text.replaceAll("_", "");
    const value = Number(compact);
    return Number.isFinite(value) ? String(value) : compact;
  }

  function hexadecimal(
    text: string,
    start: number,
    length: number,
  ): number | undefined {
    const digits = text.slice(start, start + length);
    return digits.length === length && /^[0-9a-fA-F]+$/u.test(digits)
      ? Number.parseInt(digits, 16)
      : undefined;
  }
}
