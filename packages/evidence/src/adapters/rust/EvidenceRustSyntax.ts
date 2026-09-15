import type { Node as EvidenceNode } from "web-tree-sitter";

import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { EvidenceRustVisibility } from "./EvidenceRustVisibility";

/**
 * Provides grammar-level Rust extraction helpers for names, paths, attributes,
 * and documentation.
 *
 * EvidenceRustFileScanner uses these functions to retain syntax facts.
 * EvidenceRustModuleResolver later decides crate reachability and public ownership
 * from the scanner records.
 */
export namespace EvidenceRustSyntax {
  /**
   * Reads a supported Rust identifier spelling from a grammar node.
   *
   * Scanners use it for declaration and member names; unsupported syntax
   * returns undefined so extraction can preserve uncertainty instead of
   * inventing a name.
   */
  export function name(node: EvidenceNode | null): string | undefined {
    return node !== null &&
      (node.type === "identifier" ||
        node.type === "field_identifier" ||
        node.type === "type_identifier")
      ? node.text
      : undefined;
  }

  /**
   * Classifies the visibility modifier written on a Rust declaration.
   *
   * Bare `pub` is externally public, scoped forms are restricted, and omitted
   * modifiers are private. Module resolution evaluates the resulting boundary.
   */
  export function visibility(node: EvidenceNode): EvidenceRustVisibility {
    const modifier = node.namedChildren.find(
      (child) => child.type === "visibility_modifier",
    );
    if (modifier === undefined) return "private";
    return modifier.text.trim() === "pub" ? "public" : "restricted";
  }

  /**
   * Reads a statically supported Rust path as ordered segments.
   *
   * Generic wrappers are unwrapped while `crate`, `self`, and `super` remain
   * literal segments for EvidenceRustModuleResolver to interpret in its current
   * module.
   */
  export function path(node: EvidenceNode | null): string[] | undefined {
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

  /**
   * Collects declared type-parameter names from a Rust item.
   *
   * Impl ownership resolution uses these names to distinguish local generic
   * parameters from paths that must resolve to selected nominal declarations.
   */
  export function typeParameters(node: EvidenceNode): string[] {
    const parameters = node.childForFieldName("type_parameters");
    if (parameters === null) return [];
    return parameters
      .descendantsOfType("type_parameter")
      .flatMap((parameter) => {
        const declared = name(parameter.childForFieldName("name"));
        return declared === undefined ? [] : [declared];
      });
  }

  /**
   * Collects outer attributes and outer documentation immediately preceding an
   * item.
   *
   * Ordinary comments are skipped because Rust treats them as whitespace. The
   * returned source order lets scanners attach documentation and inspect
   * attributes.
   */
  export function attributes(node: EvidenceNode): EvidenceNode[] {
    const output: EvidenceNode[] = [];
    let previous = node.previousNamedSibling;
    while (
      previous !== null &&
      (previous.type === "attribute_item" ||
        isOuterDocumentation(previous) ||
        ordinaryComment(previous))
    ) {
      if (!ordinaryComment(previous)) output.push(previous);
      previous = previous.previousNamedSibling;
    }
    return output.reverse();
  }

  /**
   * States whether a comment is ordinary Rust whitespace rather than
   * documentation.
   *
   * Attribute collection skips these comments without treating them as Evidence
   * carriers or allowing them to interrupt a valid outer-attribute sequence.
   */
  export function ordinaryComment(node: EvidenceNode): boolean {
    return (
      (node.type === "line_comment" || node.type === "block_comment") &&
      node.childForFieldName("outer") === null &&
      node.childForFieldName("inner") === null
    );
  }

  /**
   * Reads the qualified name from a Rust attribute or its wrapper item.
   *
   * Scanner attribute policy uses the name to recognize documentation and
   * report expansion risks; unsupported attribute shapes return undefined.
   */
  export function attributeName(node: EvidenceNode): string | undefined {
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

  /**
   * Returns the value expression of a Rust attribute or its wrapper item.
   *
   * Documentation-attribute handling validates this node as a supported static
   * string before it creates a carrier; absent values return null.
   */
  export function attributeValue(node: EvidenceNode): EvidenceNode | null {
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

  /**
   * States whether a Rust comment uses the outer documentation form.
   *
   * The scanner may attach only these comment carriers to following item sites.
   */
  export function outerDocumentation(node: EvidenceNode): boolean {
    return isOuterDocumentation(node);
  }

  /**
   * States whether a Rust comment uses the inner documentation form.
   *
   * Inner carriers document their containing module instead of the following
   * item.
   */
  export function innerDocumentation(node: EvidenceNode): boolean {
    return (
      (node.type === "line_comment" || node.type === "block_comment") &&
      node.childForFieldName("inner") !== null
    );
  }

  /**
   * Supplies delimiter rules for a Rust comment carrier.
   *
   * EvidenceRustFileScanner uses the returned syntax to map text and preserve tag
   * coordinates for line, block, ordinary, and documentation comment forms.
   */
  export function comment(node: EvidenceNode): IEvidenceCommentSyntax {
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

  /**
   * Supplies delimiter rules for a supported Rust string literal.
   *
   * Annotation scanning uses this result for ordinary and raw strings, whose
   * contents can report unsupported tags but cannot authorize withdrawals.
   */
  export function string(node: EvidenceNode): IEvidenceCommentSyntax | undefined {
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

  function isOuterDocumentation(node: EvidenceNode): boolean {
    return (
      (node.type === "line_comment" || node.type === "block_comment") &&
      node.childForFieldName("outer") !== null
    );
  }
}
