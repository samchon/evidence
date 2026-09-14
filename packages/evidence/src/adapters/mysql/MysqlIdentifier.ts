/** Defines source-spelled MySQL names without consulting server or filesystem settings. */
export namespace MysqlIdentifier {
  /** Unquotes backticks; other dialect delimiters and environment-dependent ANSI quotes are rejected. */
  export function read(raw: string): string | undefined {
    if (raw.startsWith("`")) {
      if (!/^`(?:[^`\u0000]|``)+`$/u.test(raw)) return undefined;
      return raw.slice(1, -1).replaceAll("``", "`");
    }
    return /^[A-Za-z_\u0080-\uFFFF][A-Za-z_0-9$\u0080-\uFFFF]*$/u.test(raw)
      ? raw
      : undefined;
  }
}
