/**
 * Decodes GoogleSQL names without inferring an ambient project or dataset.
 *
 * Explicit segments preserve schema identity across snapshots, avoiding an
 * environment-dependent address when source omits a project or dataset.
 */
export namespace EvidBigQueryIdentifier {
  /**
   * Splits a declared table path into explicit identity segments.
   *
   * A whole-path backtick pair still permits segment boundaries at dots,
   * matching BigQuery table qualification rather than treating it as one member
   * name.
   */
  export function table(raw: string): string[] | undefined {
    const quoted =
      raw.startsWith("`") &&
      raw.endsWith("`") &&
      !raw.slice(1, -1).includes("`");
    const value = quoted ? raw.slice(1, -1) : raw;
    const parts = value.split(".").map((part, index) => {
      if (quoted) return member(`\`${part}\``);
      if (index === 0 && /^[A-Za-z_][A-Za-z0-9_-]*$/u.test(part)) return part;
      return member(part);
    });
    if (parts.length > 3 || parts.some((part) => part === undefined))
      return undefined;
    return parts.filter((part) => part !== undefined);
  }

  /**
   * Decodes one member identifier without splitting its literal content.
   *
   * Unsupported escapes and line breaks are rejected because they cannot form a
   * stable selector segment.
   */
  export function member(raw: string): string | undefined {
    if (raw.startsWith("`") && raw.endsWith("`")) {
      const value = raw.slice(1, -1);
      return value.length > 0 && !/[`\\\r\n]/u.test(value) ? value : undefined;
    }
    return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(raw) ? raw : undefined;
  }

  /**
   * Normalizes a case-insensitive field or constraint identifier.
   *
   * Table paths retain their declared spelling; only member comparisons use
   * this canonical form.
   */
  export function canonical(raw: string): string | undefined {
    const value = member(raw);
    return value === undefined ? undefined : value.toLowerCase();
  }

  /**
   * Accepts documented flexible column characters, including quoted whitespace
   * and Unicode letters.
   *
   * Field validation remains separate from table-path validation because their
   * grammars differ.
   */
  export function column(raw: string): string | undefined {
    const value = member(raw);
    if (value === undefined) return undefined;
    const characters = Array.from(value);
    return characters.length <= 300 &&
      characters.every(
        (character) =>
          /^\p{L}$/u.test(character) ||
          /^\p{N}$/u.test(character) ||
          /^\p{Pc}$/u.test(character) ||
          /^\p{Pd}$/u.test(character) ||
          /^\p{M}$/u.test(character) ||
          /^[&%=+:'<>#|]$/u.test(character) ||
          /^\s$/u.test(character),
      )
      ? value
      : undefined;
  }

  /**
   * Normalizes valid field endpoints independently of case-sensitive table
   * paths.
   *
   * Foreign-key endpoint comparison needs one stable spelling for supported
   * field names.
   */
  export function canonicalColumn(raw: string): string | undefined {
    const value = column(raw);
    return value === undefined ? undefined : value.toLowerCase();
  }
}
