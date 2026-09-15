import type { Node as EvidNode } from "web-tree-sitter";

import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidRubyConstantPath } from "./IEvidRubyConstantPath";

/**
 * Provides grammar-level Ruby extraction helpers without public-surface
 * decisions.
 *
 * EvidRubyFileScanner uses these functions to recognize statically readable
 * syntax. Publication, visibility, and reopening policy remain in the scanner
 * and adapter.
 */
export namespace EvidRubySyntax {
  /**
   * Reads the bare method name from a Ruby call node.
   *
   * Directive recognition uses this result only for ordinary identifier calls;
   * other node forms remain unsupported rather than being guessed from text.
   */
  export function callName(node: EvidNode): string | undefined {
    if (node.type !== "call") return undefined;
    const method = node.childForFieldName("method");
    return method?.type === "identifier" ? method.text : undefined;
  }

  /**
   * Returns the direct named arguments of a Ruby call node.
   *
   * Attribute, visibility, and alias directives inspect this collection before
   * accepting literal arguments; non-call nodes deliberately produce no
   * arguments.
   */
  export function callArguments(node: EvidNode): EvidNode[] {
    if (node.type !== "call") return [];
    return node.childForFieldName("arguments")?.namedChildren ?? [];
  }

  /**
   * States whether a Ruby call has an explicit receiver.
   *
   * The scanner rejects or classifies directives differently when a receiver
   * changes their lexical effect, so this check does not interpret the
   * receiver.
   */
  export function hasReceiver(node: EvidNode): boolean {
    return node.type === "call" && node.childForFieldName("receiver") !== null;
  }

  /**
   * Reads a statically supported Ruby method spelling from a syntax node.
   *
   * Direct identifiers, constants, operators, and setters retain their source
   * text; literal symbols and strings are delegated to literalName.
   */
  export function methodName(node: EvidNode | null): string | undefined {
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

  /**
   * Reads a flattened list of statically literal Ruby names.
   *
   * Nested arrays are expanded for directives that accept name lists. One
   * dynamic element makes the whole result undefined so callers can report
   * uncertainty.
   */
  export function literalNames(nodes: EvidNode[]): string[] | undefined {
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

  /**
   * Reads one interpolation-free Ruby symbol or string as a literal name.
   *
   * Escape sequences and interpolation make runtime content uncertain, so
   * callers receive undefined instead of an approximated declaration name.
   */
  export function literalName(node: EvidNode): string | undefined {
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

  /**
   * Converts a supported Ruby constant expression into root-qualified path
   * segments.
   *
   * The scanner uses absolute to distinguish `::Name` from lexical lookup while
   * resolving containers, superclass paths, and generated-constant receivers.
   */
  export function constantPath(
    node: EvidNode | null,
  ): IEvidRubyConstantPath | undefined {
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

  /**
   * Identifies the normalization rules for a supported Ruby documentation
   * comment.
   *
   * Line RDoc and complete embedded RDoc blocks retain tag boundaries and
   * permit withdrawals. Other comment forms return undefined and cannot become
   * hosts.
   */
  export function commentSyntax(
    node: EvidNode,
  ): IEvidCommentSyntax | undefined {
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

  /**
   * Normalizes the explicit superclass spelling on a Ruby class declaration.
   *
   * Reopening reconciliation compares this normalized text only when a
   * superclass is supplied, preserving the distinction between omission and
   * conflict.
   */
  export function superclass(node: EvidNode): string | undefined {
    const superclass = node.childForFieldName("superclass");
    if (superclass === null) return undefined;
    return superclass.text.replace(/^\s*</u, "").replace(/\s+/gu, " ").trim();
  }

  /**
   * Detects calls that generate a runtime constant instead of a declared
   * container.
   *
   * EvidRubyFileScanner reports these forms as incomplete because their members
   * cannot be derived from the declared source model without executing Ruby.
   */
  export function generatedConstant(node: EvidNode | null): boolean {
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
