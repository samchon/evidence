/**
 * Defines source-spelled MySQL names without consulting server or filesystem settings.
 *
 * The adapter preserves this deterministic identity across hosts with different server policy.
 */
export namespace MysqlIdentifier {
  /**
   * Unquotes backticks and rejects other dialect delimiters or ANSI quotes.
   *
   * Their interpretation can depend on server configuration outside a source snapshot.
   */
  export function read(raw: string): string | undefined {
    if (raw.includes("\0") || /[\uD800-\uDFFF]/.test(raw)) return undefined;
    if (raw.startsWith("`")) {
      if (!/^`(?:[^`]|``)+`$/u.test(raw)) return undefined;
      const name = raw.slice(1, -1).replaceAll("``", "`");
      return name.endsWith(" ") ? undefined : name;
    }
    return /^[A-Za-z_\u0080-\uFFFF][A-Za-z_0-9$\u0080-\uFFFF]*$/u.test(raw)
      ? raw
      : undefined;
  }
}
