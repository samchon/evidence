import path from "node:path";

/**
 * Performs lexical path normalization without filesystem access or case folding.
 *
 * Source discovery owns physical resolution; these helpers preserve authored
 * spelling boundaries so logical addresses remain portable across platforms.
 */
export namespace SourcePath {
  /**
   * Resolves a portable absolute or relative path and rejects drive-relative notation.
   *
   * Source collection uses the result for lexical addressing before physical
   * resolution, preserving platform-independent configured path behavior.
   */
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

  /**
   * Resolves a configured population root while keeping glob syntax confined to files.
   *
   * Roots must name concrete directories, so this boundary rejects glob markers
   * before discovery can confuse a pattern with a filesystem location.
   */
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

  /**
   * Produces a slash-normalized diagnostic path relative to a stable display base.
   *
   * Diagnostic and public source addresses use this display spelling without
   * changing the absolute path used for filesystem operations.
   */
  export function display(base: string, absolute: string): string {
    const relative = slash(path.relative(base, absolute));
    return relative === "" ? "." : relative;
  }

  /**
   * Tests both logical and resolved physical paths when bounding reexports.
   *
   * A path is inside the selected root only when neither authored symlink paths
   * nor their resolved filesystem locations escape that boundary.
   */
  export function contains(root: string, absolute: string): boolean {
    const prefix = normalize(root);
    const target = normalize(absolute);
    return (
      target === prefix ||
      target.startsWith(prefix.endsWith("/") ? prefix : prefix + "/")
    );
  }

  /**
   * Converts separators without canonicalizing dot segments or case.
   *
   * Callers use this narrow normalization for portable keys while physical path
   * resolution remains responsible for filesystem-aware canonicalization.
   */
  export function slash(value: string): string {
    return value.replaceAll("\\", "/");
  }

  /**
   * Selects the appropriate path flavor for lexical containment comparison.
   *
   * This helper deliberately avoids filesystem access, allowing root-boundary
   * checks to operate on configured and resolved path spellings alike.
   */
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
