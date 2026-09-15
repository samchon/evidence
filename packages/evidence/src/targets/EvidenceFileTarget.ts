import path from "node:path";

import type { IEvidenceAddress } from "../structures/IEvidenceAddress";

import { EvidenceAccessor } from "./EvidenceAccessor";

/**
 * Converts file-qualified evidence targets between authored text and addresses.
 *
 * A target names either a file unit or a public accessor within a file. Parsing
 * resolves the file portion relative to the documentation host without reading
 * the filesystem; later resolution decides whether that normalized path belongs
 * to the selected population. Formatting provides stable diagnostic and review
 * text without changing literal accessor segments.
 *
 * @example
 *   EvidenceFileTarget.parse(
 *     "../api/client.ts#Client.prototype.send",
 *     "/repo/docs/guide.md",
 *   );
 */
export namespace EvidenceFileTarget {
  /**
   * Parses an authored file target relative to the documentation host's file.
   *
   * A missing hash selects the file unit; a hash must be followed by an
   * accessor. The file component permits percent encoding for reserved path
   * characters, whereas accessor parsing remains delegated to `EvidenceAccessor`.
   * The origin must be absolute so the same citation cannot resolve differently
   * by process working directory.
   */
  export function parse(target: string, origin: string): IEvidenceAddress {
    const hash = target.indexOf("#");
    if (hash === target.length - 1)
      throw new Error(
        "Name a public accessor after '#', or omit '#' when citing the file unit itself.",
      );
    const encoded = hash < 0 ? target : target.slice(0, hash);
    if (encoded === "") throw new Error("Name the file before '#'.");
    let decoded: string;
    try {
      decoded = decodeURIComponent(encoded);
    } catch {
      throw new Error(
        "Use valid percent escapes in the file path; write %20 for a space and %23 for a literal '#'.",
      );
    }
    if (
      decoded.includes("\0") ||
      decoded.includes("\r") ||
      decoded.includes("\n")
    )
      throw new Error("Target paths cannot contain NUL or line breaks.");
    return {
      file: resolve(origin, decoded),
      segments: hash < 0 ? [] : EvidenceAccessor.parse(target.slice(hash + 1)),
    };
  }

  /**
   * Formats a normalized address as canonical file-target text.
   *
   * Reserved path characters are percent-encoded, but directory separators and
   * Windows drive separators stay readable. The accessor is formatted
   * separately so literal segment characters cannot change the file/path
   * boundary.
   */
  export function format(address: IEvidenceAddress): string {
    const encoded = encodeURIComponent(normalize(address.file))
      .replaceAll("%2F", "/")
      .replace(/^([A-Za-z])%3A\//u, "$1:/");
    return address.segments.length === 0
      ? encoded
      : encoded + "#" + EvidenceAccessor.format(address.segments);
  }

  /**
   * Normalizes separators and dot segments without consulting the filesystem.
   *
   * This is lexical normalization only: symlinks, case rules, and file
   * existence remain the scanner's responsibility. The UNC guard preserves a
   * leading pair of slashes only when the author actually supplied a UNC path.
   */
  export function normalize(file: string): string {
    const slash = file.replaceAll("\\", "/");
    const flavor = windows(slash) ? path.win32 : path.posix;
    const normalized = flavor.normalize(slash).replaceAll("\\", "/");
    return normalized.startsWith("//") && !slash.startsWith("//")
      ? normalized.slice(1)
      : normalized;
  }

  /**
   * Resolves a decoded file request using the host file's path flavor.
   *
   * Drive-relative requests are rejected because Windows interprets them
   * against a process-local drive directory. Selecting POSIX or Windows
   * semantics from either input keeps cross-platform inventories
   * deterministic.
   */
  function resolve(origin: string, file: string): string {
    const base = normalize(origin);
    if (!absolute(base))
      throw new Error("The citing file origin must be an absolute path.");
    const request = file.replaceAll("\\", "/");
    if (/^[A-Za-z]:(?!\/)/u.test(request))
      throw new Error("A target file path cannot be drive-relative.");
    const flavor = windows(base) || windows(request) ? path.win32 : path.posix;
    return flavor.resolve(flavor.dirname(base), request).replaceAll("\\", "/");
  }

  /**
   * Checks the portable absolute-path forms accepted for documentation origins.
   *
   * Origins are scanner-owned absolute locations; accepting a relative origin
   * would make a source annotation depend on the process working directory.
   */
  function absolute(file: string): boolean {
    return file.startsWith("/") || /^[A-Za-z]:\//u.test(file);
  }

  /**
   * Detects Windows drive and UNC spellings after separators are normalized.
   *
   * This selects `path.win32` even when an inventory is inspected on a POSIX
   * host.
   */
  function windows(file: string): boolean {
    return /^[A-Za-z]:\//u.test(file) || file.startsWith("//");
  }
}
