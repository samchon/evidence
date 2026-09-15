import typia from "typia";

/**
 * Converts the accessor portion of a file-qualified target between text and segments.
 *
 * Target resolution uses segments to distinguish lexical ownership from a literal
 * dot in a member name. This namespace accepts the portable baseline syntax only:
 * identifiers after dots, JSON strings in brackets, and non-negative integer
 * bracket members. It neither resolves symbols nor interprets a segment as code.
 *
 * @example
 * EvidAccessor.parse('Client.prototype["send.request"]');
 * // ["Client", "prototype", "send.request"]
 */
export namespace EvidAccessor {
  /**
   * Parses one accessor spelling into the literal segments used by an address.
   *
   * A bracket string preserves characters that have structural meaning in dotted
   * syntax. Invalid separators, unterminated brackets, and unsupported bracket
   * content reject before a resolver can look up a different declaration.
   */
  export function parse(value: string): string[] {
    const segments: string[] = [];
    let cursor = 0;
    while (cursor < value.length) {
      if (value[cursor] === "[") {
        const start = ++cursor;
        let quoted = false;
        let escaped = false;
        while (cursor < value.length) {
          const character = value[cursor];
          if (escaped) escaped = false;
          else if (quoted && character === "\\") escaped = true;
          else if (character === '"') quoted = !quoted;
          else if (!quoted && character === "]") break;
          ++cursor;
        }
        if (cursor === value.length)
          throw new Error(
            "Close the bracket accessor and its quoted member name.",
          );
        const literal = value.slice(start, cursor++);
        // JSON parsing handles escapes exactly as the canonical formatter emits
        // them, while numeric brackets remain literal accessor segments.
        if (literal.startsWith('"'))
          segments.push(typia.json.assertParse<string>(literal));
        else if (/^(?:0|[1-9][0-9]*)$/.test(literal)) segments.push(literal);
        else
          throw new Error(
            "A bracket accessor must contain a JSON string or an unsigned integer without leading zeroes.",
          );
      } else {
        const start = cursor;
        while (
          cursor < value.length &&
          value[cursor] !== "." &&
          value[cursor] !== "["
        )
          ++cursor;
        const segment = value.slice(start, cursor);
        if (!identifier(segment))
          throw new Error(
            "Use dotted identifiers or JSON-string brackets for literal member names.",
          );
        segments.push(segment);
      }
      if (cursor === value.length) break;
      if (value[cursor] === ".") {
        ++cursor;
        if (cursor === value.length || value[cursor] === "[")
          throw new Error("A dot must be followed by an identifier.");
      } else if (value[cursor] !== "[")
        throw new Error("Separate accessor segments with a dot or a bracket.");
    }
    if (segments.length === 0)
      throw new Error("Name a public declaration after '#'.");
    return segments;
  }

  /**
   * Serializes literal accessor segments in the canonical target spelling.
   *
   * Identifier segments use dotted notation. Every other segment is JSON-quoted
   * in brackets so formatting cannot turn a literal dot, bracket, or space into
   * an accidental parent relationship. Empty paths are invalid because a target
   * accessor must identify at least one declaration segment.
   */
  export function format(segments: string[]): string {
    if (segments.length === 0)
      throw new Error("An accessor needs at least one segment.");
    let output = "";
    for (const segment of segments)
      output += identifier(segment)
        ? (output === "" ? "" : ".") + segment
        : "[" + JSON.stringify(segment) + "]";
    return output;
  }

  /**
   * Determines whether one segment is safe in dotted accessor notation.
   *
   * The Unicode-aware expression matches the baseline's identifier subset. A
   * segment outside that subset remains valid, but `format` must quote it.
   */
  function identifier(value: string): boolean {
    return /^(?:[$_]|\p{L})(?:[$_]|\p{L}|\p{Nd}|\p{M})*$/u.test(value);
  }
}
