import type { Node } from "web-tree-sitter";

import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { CSharpAccessibility } from "./CSharpAccessibility";

/** Grammar-specific C# names, modifiers, documentation, and special members. */
export namespace CSharpSyntax {
  export function name(node: Node | null): string | undefined {
    if (node === null || node.type !== "identifier") return undefined;
    const value = node.text.startsWith("@") ? node.text.slice(1) : node.text;
    return value
      .replace(/\\u([0-9A-Fa-f]{4})/gu, (_match, hex: string) =>
        String.fromCodePoint(Number.parseInt(hex, 16)),
      )
      .replace(/\\U([0-9A-Fa-f]{8})/gu, (match, hex: string) => {
        const codePoint = Number.parseInt(hex, 16);
        return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
      });
  }

  export function path(node: Node | null): string[] | undefined {
    if (node === null) return undefined;
    const direct = name(node);
    if (direct !== undefined) return [direct];
    if (node.type !== "qualified_name") return undefined;
    const qualifier = path(node.childForFieldName("qualifier"));
    const suffix = name(node.childForFieldName("name"));
    return qualifier === undefined || suffix === undefined
      ? undefined
      : [...qualifier, suffix];
  }

  export function typeParameterArity(node: Node): number {
    const parameters = node.namedChildren.find(
      (child) => child.type === "type_parameter_list",
    );
    return parameters === undefined
      ? 0
      : parameters.namedChildren.filter(
          (child) => child.type === "type_parameter",
        ).length;
  }

  export function hasModifier(node: Node, modifier: string): boolean {
    return node.namedChildren.some(
      (child) => child.type === "modifier" && child.text === modifier,
    );
  }

  export function hasToken(node: Node, token: string): boolean {
    return node.children.some((child) => child.type === token);
  }

  export function accessibility(node: Node): CSharpAccessibility {
    const modifiers = new Set(
      node.namedChildren
        .filter((child) => child.type === "modifier")
        .map((child) => child.text),
    );
    if (modifiers.has("public")) return "public";
    if (modifiers.has("private") && modifiers.has("protected"))
      return "private-protected";
    if (modifiers.has("protected") && modifiers.has("internal"))
      return "protected-internal";
    if (modifiers.has("private")) return "private";
    if (modifiers.has("protected")) return "protected";
    if (modifiers.has("internal")) return "internal";
    if (modifiers.has("file")) return "file";
    return "default";
  }

  export function isXmlDocumentation(node: Node): boolean {
    return (
      node.type === "comment" &&
      (node.text.startsWith("///") || node.text.startsWith("/**"))
    );
  }

  export function comment(node: Node): IEvidenceCommentSyntax {
    if (node.text.startsWith("///"))
      return {
        opening: "///",
        closing: "",
        linePrefix: "///",
        tagBoundaries: true,
        allowWithdrawal: true,
      };
    if (node.text.startsWith("//"))
      return {
        opening: "//",
        closing: "",
        linePrefix: "//",
        tagBoundaries: true,
        allowWithdrawal: false,
      };
    const documentation = node.text.startsWith("/**");
    return {
      opening: documentation ? "/**" : "/*",
      closing: "*/",
      linePrefix: "*",
      tagBoundaries: true,
      allowWithdrawal: documentation,
    };
  }

  export function explicitInterface(node: Node): boolean {
    return node.namedChildren.some(
      (child) => child.type === "explicit_interface_specifier",
    );
  }

  export function operatorName(node: Node): string | undefined {
    const operator = node.childForFieldName("operator");
    if (operator === null) return undefined;
    const checked = node.children.some((child) => child.type === "checked");
    return `operator ${checked ? "checked " : ""}${operator.text}`;
  }

  export function conversionOperatorName(node: Node): string | undefined {
    const type = node.childForFieldName("type");
    if (type === null) return undefined;
    const conversion = node.children.some((child) => child.type === "implicit")
      ? "implicit"
      : node.children.some((child) => child.type === "explicit")
        ? "explicit"
        : undefined;
    const checked = node.children.some((child) => child.type === "checked");
    return conversion === undefined
      ? undefined
      : `${conversion} operator ${checked ? "checked " : ""}${normalize(type.text)}`;
  }

  export function string(node: Node): IEvidenceCommentSyntax | undefined {
    const rawOpening = node.namedChildren.find(
      (child) => child.type === "raw_string_start",
    );
    const rawClosing = node.namedChildren.find(
      (child) => child.type === "raw_string_end",
    );
    if (rawOpening !== undefined && rawClosing !== undefined)
      return {
        opening: rawOpening.text,
        closing: rawClosing.text + (node.text.endsWith("u8") ? "u8" : ""),
        tagBoundaries: true,
        allowWithdrawal: false,
      };

    if (node.type === "verbatim_string_literal")
      return {
        opening: '@"',
        closing: node.text.endsWith('"u8') ? '"u8' : '"',
        tagBoundaries: true,
        allowWithdrawal: false,
      };
    if (node.type === "string_literal")
      return {
        opening: '"',
        closing: node.text.endsWith('"u8') ? '"u8' : '"',
        tagBoundaries: true,
        allowWithdrawal: false,
      };
    if (node.type !== "interpolated_string_expression") return undefined;
    const opening = /^(?:\$+@?"|@\$+")/u.exec(node.text)?.[0];
    return opening === undefined
      ? undefined
      : {
          opening,
          closing: node.text.endsWith('"u8') ? '"u8' : '"',
          tagBoundaries: true,
          allowWithdrawal: false,
        };
  }

  function normalize(value: string): string {
    return value.replace(/\s+/gu, " ").trim();
  }
}
