import path from "node:path";

/**
 * Performs lexical path normalization without filesystem access or case folding.
 *
 * Source discovery owns physical resolution; these helpers preserve authored
 * spelling boundaries so logical addresses remain portable across platforms.
 */
export namespace SourcePath {
  /** Resolves a portable absolute or relative path and rejects ambiguous drive-relative notation. */
  export function resolve(base: string, value: string): string {
    const normalized = value.replaceAll("\\", "/");
    if (/^[A-Za-z]:(?!\/)/.test(normalized))
      throw new Error(
        `Path '${value}' is drive-relative; write its full path.`,
      );
    if (process.platform !== "win32" && /^[A-Za-z]:/.test(normalized))
      throw new Error(
        `Windows path '${value}' cannot be resolved on this platform.`,
      );
    return slash(path.resolve(base, normalized));
  }

  /** Resolves a configured population root while keeping glob syntax confined to files. */
  export function root(configFile: string, declared: string): string {
    if (declared.trim() !== declared || declared === "")
      throw new Error(
        "A population root must not be empty or padded with whitespace.",
      );
    if (declared.includes("*") || declared.includes("?"))
      throw new Error(
        "A population root names one directory; put globs in files.",
      );
    return resolve(path.dirname(path.resolve(configFile)), declared);
  }

  /** Produces a slash-normalized diagnostic path relative to a stable display base. */
  export function display(base: string, absolute: string): string {
    const relative = slash(path.relative(base, absolute));
    return relative === "" ? "." : relative;
  }

  /** Test both logical and resolved physical paths when bounding reexports. */
  export function contains(root: string, absolute: string): boolean {
    const prefix = normalize(root);
    const target = normalize(absolute);
    return (
      target === prefix ||
      target.startsWith(prefix.endsWith("/") ? prefix : prefix + "/")
    );
  }

  /** Converts separators only; it deliberately does not canonicalize dot segments or case. */
  export function slash(value: string): string {
    return value.replaceAll("\\", "/");
  }

  /** Uses the appropriate path flavor for containment comparison without touching the filesystem. */
  function normalize(value: string): string {
    const normalized = slash(value);
    const flavor =
      /^[A-Za-z]:/.test(normalized) || normalized.startsWith("//")
        ? path.win32
        : path.posix;
    const result = slash(flavor.normalize(normalized)).replace(/\/+$/, "");
    return result === "" ? "/" : result;
  }
}
