import type { Node } from "web-tree-sitter";

import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { RustVisibility } from "./RustVisibility";

/** Grammar-specific Rust names, paths, visibility, attributes, and documentation. */
export namespace RustSyntax {
  export function name(node: Node | null): string | undefined {
    return node !== null &&
      (node.type === "identifier" ||
        node.type === "field_identifier" ||
        node.type === "type_identifier")
      ? node.text
      : undefined;
  }

  export function visibility(node: Node): RustVisibility {
    const modifier = node.namedChildren.find(
      (child) => child.type === "visibility_modifier",
    );
    if (modifier === undefined) return "private";
    return modifier.text.trim() === "pub" ? "public" : "restricted";
  }

  export function path(node: Node | null): string[] | undefined {
    if (node === null) return undefined;
    const direct = name(node);
    if (direct !== undefined) return [direct];
    if (node.type === "crate" || node.type === "self" || node.type === "super")
      return [node.text];
    if (
      node.type === "scoped_identifier" ||
      node.type === "scoped_type_identifier"
    ) {
      const prefix = path(node.childForFieldName("path"));
      const suffix = name(node.childForFieldName("name"));
      return prefix === undefined || suffix === undefined
        ? undefined
        : [...prefix, suffix];
    }
    if (node.type === "generic_type")
      return path(node.childForFieldName("type"));
    return undefined;
  }

  export function typeParameters(node: Node): string[] {
    const parameters = node.childForFieldName("type_parameters");
    if (parameters === null) return [];
    return parameters
      .descendantsOfType("type_parameter")
      .flatMap((parameter) => {
        const declared = name(parameter.childForFieldName("name"));
        return declared === undefined ? [] : [declared];
      });
  }

  export function attributes(node: Node): Node[] {
    const output: Node[] = [];
    let previous = node.previousNamedSibling;
    while (
      previous !== null &&
      (previous.type === "attribute_item" || isOuterDocumentation(previous))
    ) {
      output.push(previous);
      previous = previous.previousNamedSibling;
    }
    return output.reverse();
  }

  export function attributeName(node: Node): string | undefined {
    const attribute =
      node.type === "attribute_item" || node.type === "inner_attribute_item"
        ? (node.namedChildren.find((child) => child.type === "attribute") ??
          null)
        : node.type === "attribute"
          ? node
          : null;
    if (attribute === null) return undefined;
    const head = attribute.namedChildren[0] ?? null;
    const segments = path(head);
    return segments === undefined ? undefined : segments.join("::");
  }

  export function attributeValue(node: Node): Node | null {
    const attribute =
      node.type === "attribute_item" || node.type === "inner_attribute_item"
        ? (node.namedChildren.find((child) => child.type === "attribute") ??
          null)
        : node.type === "attribute"
          ? node
          : null;
    return attribute === null
      ? null
      : (attribute.childForFieldName("value") ?? null);
  }

  export function outerDocumentation(node: Node): boolean {
    return isOuterDocumentation(node);
  }

  export function innerDocumentation(node: Node): boolean {
    return (
      (node.type === "line_comment" || node.type === "block_comment") &&
      node.childForFieldName("inner") !== null
    );
  }

  export function comment(node: Node): IEvidenceCommentSyntax {
    const outer = isOuterDocumentation(node);
    const inner = innerDocumentation(node);
    const opening =
      node.type === "line_comment"
        ? outer
          ? "///"
          : inner
            ? "//!"
            : "//"
        : outer
          ? "/**"
          : inner
            ? "/*!"
            : "/*";
    return opening.startsWith("//")
      ? {
          opening,
          closing: "",
          linePrefix: opening,
          tagBoundaries: true,
          allowWithdrawal: true,
        }
      : {
          opening,
          closing: "*/",
          linePrefix: "*",
          tagBoundaries: true,
          allowWithdrawal: true,
        };
  }

  export function string(node: Node): IEvidenceCommentSyntax | undefined {
    if (node.type === "string_literal")
      return {
        opening: '"',
        closing: '"',
        tagBoundaries: true,
        allowWithdrawal: false,
      };
    if (node.type === "raw_string_literal") {
      const match = /^(?:br|r)(#*)"/u.exec(node.text);
      if (match === null) return undefined;
      const hashes = match[1] ?? "";
      return {
        opening: node.text.slice(0, match[0].length),
        closing: `"${hashes}`,
        tagBoundaries: true,
        allowWithdrawal: false,
      };
    }
    return undefined;
  }

  function isOuterDocumentation(node: Node): boolean {
    return (
      (node.type === "line_comment" || node.type === "block_comment") &&
      node.childForFieldName("outer") !== null
    );
  }
}
