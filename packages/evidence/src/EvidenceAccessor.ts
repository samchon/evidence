import typia from "typia";

/** Parses the baseline's dotted identifiers, JSON-string brackets, and unsigned integer brackets. */
export namespace EvidenceAccessor {
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

  /** Canonical formatting never turns a literal dot into a parent relationship. */
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

  function identifier(value: string): boolean {
    return /^(?:[$_]|\p{L})(?:[$_]|\p{L}|\p{Nd}|\p{M})*$/u.test(value);
  }
}
