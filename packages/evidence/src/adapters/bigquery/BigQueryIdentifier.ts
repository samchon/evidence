/** Decodes GoogleSQL names without inferring an ambient project or dataset. */
export namespace BigQueryIdentifier {
  /** Splits table paths, including a backtick pair enclosing the whole path. */
  export function table(raw: string): string[] | undefined {
    const value =
      raw.startsWith("`") &&
      raw.endsWith("`") &&
      !raw.slice(1, -1).includes("`")
        ? raw.slice(1, -1)
        : raw;
    const parts = value.split(".").map(member);
    if (parts.length > 3 || parts.some((part) => part === undefined))
      return undefined;
    return parts.filter((part) => part !== undefined);
  }

  /** Keeps a quoted field name as one segment, including literal dots. */
  export function member(raw: string): string | undefined {
    if (raw.startsWith("`") && raw.endsWith("`")) {
      const value = raw.slice(1, -1);
      return value.length > 0 && !/[`\\\r\n]/u.test(value) ? value : undefined;
    }
    return /^[\p{L}_][\p{L}\p{N}_-]*$/u.test(raw) ? raw : undefined;
  }
}
