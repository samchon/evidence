import type { Node as EvidNode } from "web-tree-sitter";

import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";

/**
 * Provides grammar-specific Python syntax helpers without export decisions.
 *
 * EvidPythonFileScanner uses these helpers to recognize supported declaration and
 * documentation shapes while keeping public-surface policy in the scanner.
 */
export namespace EvidPythonSyntax {
  /**
   * Unwraps a decorated definition to its underlying declaration node.
   *
   * Callers retain the wrapper separately when its range or decorators affect
   * documentation attachment and static-versus-instance member classification.
   */
  export function definition(node: EvidNode): EvidNode {
    return node.type === "decorated_definition"
      ? (node.childForFieldName("definition") ?? node)
      : node;
  }

  /**
   * Returns an identifier's source spelling when the node is a simple name.
   *
   * Other grammar forms remain unsupported instead of being coerced into a
   * potentially incorrect declaration or binding name.
   */
  export function name(node: EvidNode | null): string | undefined {
    return node?.type === "identifier" ? node.text : undefined;
  }

  /**
   * Extracts the leftmost identifier from a Python type-alias declaration.
   *
   * The scanner requires this static name before it can create an owned type
   * unit or a module binding for the alias.
   */
  export function typeAliasName(node: EvidNode): string | undefined {
    const left = node.childForFieldName("left");
    if (left === null) return undefined;
    return left.descendantsOfType("identifier")[0]?.text;
  }

  /**
   * Returns the simple left-side name of an assignment expression.
   *
   * Destructuring and attribute assignments intentionally return no name so the
   * scanner can distinguish unsupported dynamic surfaces from declarations.
   */
  export function assignmentName(node: EvidNode): string | undefined {
    return name(node.childForFieldName("left"));
  }

  /**
   * Collects canonical decorator spellings from a decorated declaration wrapper.
   *
   * Method scanning uses these spellings to recognize static, class, property,
   * and cached-property ownership without evaluating arbitrary decorators.
   */
  export function decoratorNames(wrapper: EvidNode): string[] {
    if (wrapper.type !== "decorated_definition") return [];
    return wrapper.namedChildren
      .filter((child) => child.type === "decorator")
      .flatMap((decorator) => {
        const expression = decorator.namedChildren[0];
        const value = qualified(expression);
        return value === undefined ? [] : [value];
      });
  }

  /**
   * Returns the first parameter name of a function definition when recoverable.
   *
   * Initializer scanning treats this name as the instance receiver for direct
   * field assignments; missing or complex forms do not establish instance fields.
   */
  export function parameterName(node: EvidNode): string | undefined {
    const parameters = node.childForFieldName("parameters");
    if (parameters === null) return undefined;
    const first = parameters.namedChildren[0];
    if (first === undefined) return undefined;
    if (first.type === "identifier") return first.text;
    return first.descendantsOfType("identifier")[0]?.text;
  }

  /**
   * Returns the direct object name of an attribute expression.
   *
   * Instance-field extraction combines this with {@link attributeName} to accept
   * only assignments on the initializer's statically identified receiver.
   */
  export function attributeObject(node: EvidNode): string | undefined {
    if (node.type !== "attribute") return undefined;
    return name(node.childForFieldName("object"));
  }

  /**
   * Returns the direct member name of an attribute expression.
   *
   * A non-attribute expression has no eligible member name and remains outside
   * the scanner's supported direct-receiver assignment form.
   */
  export function attributeName(node: EvidNode): string | undefined {
    if (node.type !== "attribute") return undefined;
    return name(node.childForFieldName("attribute"));
  }

  /**
   * Builds documentation mapping syntax for a non-interpolated string literal.
   *
   * Interpolated strings are omitted because runtime interpolation prevents the
   * scanner from treating their text as stable Evid documentation.
   */
  export function stringSyntax(node: EvidNode): IEvidCommentSyntax | undefined {
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

  /**
   * Returns the line-comment syntax used for Python comment documentation.
   *
   * The fixed mapping lets adjacent standalone `#` comment runs support Evid
   * tags with the same withdrawal behavior as supported docstrings.
   */
  export function commentSyntax(): IEvidCommentSyntax {
    return {
      opening: "#",
      closing: "",
      linePrefix: "#",
      tagBoundaries: true,
      allowWithdrawal: true,
    };
  }

  /**
   * Resolves a supported literal list or tuple expression to its string members.
   *
   * Static `+` composition and parentheses are accepted for `__all__`; any
   * dynamic value returns undefined so the scanner preserves incompleteness.
   */
  export function literalSequence(node: EvidNode | null): string[] | undefined {
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

  /**
   * Reads one plain static Python string literal for an export-name sequence.
   *
   * Escapes, line breaks, and prefixes other than `u` or `U` are rejected so
   * the literal value need not be interpreted by executing Python syntax.
   */
  export function literalString(node: EvidNode): string | undefined {
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

  /**
   * Returns the leading expression node when a suite begins with a docstring.
   *
   * Leading comments are skipped, but the first executable statement must be a
   * supported string expression for attachment to the enclosing declaration.
   */
  export function docstring(body: EvidNode | null): EvidNode | undefined {
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

  /**
   * Splits a supported docstring expression into its source string literals.
   *
   * Bytes and f-string components are excluded because their runtime semantics
   * cannot supply stable documentation text for Evid annotations.
   */
  export function docstringParts(node: EvidNode): EvidNode[] | undefined {
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

  /**
   * Detects a `TypeAlias` annotation on a simple assignment.
   *
   * The scanner uses this syntactic marker to classify the assigned declaration
   * as a type unit while leaving other assignments as properties.
   */
  export function typeAliasAnnotation(node: EvidNode): boolean {
    const annotation = node.childForFieldName("type")?.text;
    return (
      annotation === "TypeAlias" ||
      (annotation !== undefined && annotation.endsWith(".TypeAlias"))
    );
  }

  /**
   * Serializes a supported identifier, attribute, call, or parenthesized decorator expression.
   *
   * Decorator recognition requires only the callable's dotted spelling; other
   * expression forms remain unclassified rather than being evaluated.
   */
  function qualified(node: EvidNode | undefined): string | undefined {
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

  /**
   * Checks whether a string literal can participate in a static Python docstring.
   *
   * Bytes and formatted literals are rejected because they cannot provide stable
   * source text without runtime evaluation.
   */
  function docstringLiteral(node: EvidNode): boolean {
    const syntax = stringSyntax(node);
    if (syntax === undefined) return false;
    const quote = /(?:'''|"""|'|")$/u.exec(syntax.opening)?.[0];
    if (quote === undefined) return false;
    const prefix = syntax.opening.slice(0, -quote.length).toLowerCase();
    return !prefix.includes("b") && !prefix.includes("f");
  }
}
