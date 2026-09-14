import type { Node } from "web-tree-sitter";

import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { CDeclarationForm } from "./CDeclarationForm";
import type { CDeclaratorKind } from "./CDeclaratorKind";
import type { ICDeclaratorShape } from "./ICDeclaratorShape";

/** Grammar-specific C names, declarators, comments, and declaration modifiers. */
export namespace CSyntax {
  export function name(node: Node | null): string | undefined {
    if (
      node === null ||
      !["identifier", "field_identifier", "type_identifier"].includes(node.type)
    )
      return undefined;
    return node.text
      .replace(/\\u([0-9A-Fa-f]{4})/gu, (_match, hex: string) =>
        String.fromCodePoint(Number.parseInt(hex, 16)),
      )
      .replace(/\\U([0-9A-Fa-f]{8})/gu, (match, hex: string) => {
        const codePoint = Number.parseInt(hex, 16);
        return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
      });
  }

  export function declarators(node: Node): Node[] {
    return node.childrenForFieldName("declarator");
  }

  export function declarator(node: Node): ICDeclaratorShape | undefined {
    let current: Node | null = node;
    let nearest: CDeclaratorKind = "direct";
    while (current !== null) {
      const value = name(current);
      if (value !== undefined) return { name: value, kind: nearest, node };
      switch (current.type) {
        case "init_declarator":
        case "attributed_declarator":
          current = childDeclarator(current);
          break;
        case "parenthesized_declarator":
          current = declaratorChild(current);
          break;
        case "function_declarator":
          nearest = "function";
          current = childDeclarator(current);
          break;
        case "pointer_declarator":
        case "array_declarator":
          nearest = "object";
          current = childDeclarator(current);
          break;
        default:
          current = childDeclarator(current);
      }
    }
    return undefined;
  }

  export function tagForm(
    node: Node | null,
  ): Extract<CDeclarationForm, "struct" | "union" | "enum"> | null {
    if (node?.type === "struct_specifier") return "struct";
    if (node?.type === "union_specifier") return "union";
    if (node?.type === "enum_specifier") return "enum";
    return null;
  }

  export function storage(node: Node, value: string): boolean {
    return node.namedChildren.some(
      (child) =>
        child.type === "storage_class_specifier" && child.text === value,
    );
  }

  export function isStaticAssertion(node: Node): boolean {
    return /^(?:_Static_assert|static_assert)\s*\(/u.test(node.text);
  }

  export function guardedDeclarations(node: Node): Node[] | undefined {
    if (node.type !== "preproc_ifdef" || !/^#\s*ifndef\b/u.test(node.text))
      return undefined;
    if (node.childForFieldName("alternative") !== null) return undefined;
    const nameNode = node.childForFieldName("name");
    const guard = name(nameNode);
    if (guard === undefined) return undefined;
    const body = node.namedChildren.slice(1);
    const definition = body[0];
    if (
      definition?.type !== "preproc_def" ||
      name(definition.childForFieldName("name")) !== guard
    )
      return undefined;
    return body.slice(1);
  }

  export function isInertDirective(node: Node): boolean {
    if (node.type !== "preproc_call") return false;
    const directive = node.childForFieldName("directive")?.text;
    const argumentNode = node.childForFieldName("argument");
    const argument =
      argumentNode === null ? undefined : argumentNode.text.trim();
    return (
      directive === "#undef" ||
      directive === "#line" ||
      (directive === "#pragma" && argument === "once")
    );
  }

  export function isDoxygen(node: Node): boolean {
    return (
      node.type === "comment" &&
      /^(?:\/\*\*|\/\*!|\/\/\/|\/\/!)/u.test(node.text)
    );
  }

  export function isTrailingDoxygen(node: Node): boolean {
    return (
      node.type === "comment" &&
      /^(?:\/\*\*<|\/\*!<|\/\/\/<|\/\/!<)/u.test(node.text)
    );
  }

  export function comment(node: Node): IEvidenceCommentSyntax {
    for (const opening of ["///<", "//!<", "///", "//!", "//"])
      if (node.text.startsWith(opening))
        return {
          opening,
          closing: "",
          linePrefix: opening,
          tagBoundaries: true,
          allowWithdrawal: opening !== "//",
        };
    for (const opening of ["/**<", "/*!<", "/**", "/*!", "/*"])
      if (node.text.startsWith(opening))
        return {
          opening,
          closing: "*/",
          linePrefix: "*",
          tagBoundaries: true,
          allowWithdrawal: opening !== "/*",
        };
    return {
      opening: "/*",
      closing: "*/",
      tagBoundaries: true,
      allowWithdrawal: false,
    };
  }

  export function string(node: Node): IEvidenceCommentSyntax | undefined {
    if (node.type !== "string_literal") return undefined;
    const prefix = /^(?:u8|u|U|L)?"/u.exec(node.text)?.[0];
    return prefix === undefined
      ? undefined
      : {
          opening: prefix,
          closing: '"',
          tagBoundaries: true,
          allowWithdrawal: false,
        };
  }

  function childDeclarator(node: Node): Node | null {
    return node.childForFieldName("declarator") ?? declaratorChild(node);
  }

  function declaratorChild(node: Node): Node | null {
    return (
      node.namedChildren.find(
        (child) =>
          name(child) !== undefined ||
          child.type.endsWith("_declarator") ||
          child.type === "parenthesized_declarator",
      ) ?? null
    );
  }
}
