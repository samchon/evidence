import { createHash } from "node:crypto";
import type { BigIntStats, Dirent } from "node:fs";
import {
  lstat,
  readFile,
  readdir,
  readlink,
  realpath,
  stat,
} from "node:fs/promises";

import type { IEvidenceSourceDependency } from "../structures/IEvidenceSourceDependency";

/**
 * Immutable filesystem versions used to validate a watch attempt before publication.
 *
 * Versions include symlink and directory-entry state because either can change
 * which source is read; a content-only check would miss resolution changes.
 */
export class WatchDependencySnapshot {
  /** Creates a snapshot from already captured dependency version strings. */
  private constructor(private readonly versions: ReadonlyMap<string, string>) {}

  /** Asynchronously captures every dependency, encoding inaccessible paths as observable failures. */
  public static async capture(
    dependencies: IEvidenceSourceDependency[],
  ): Promise<WatchDependencySnapshot> {
    const versions = new Map<string, string>();
    for (const dependency of dependencies)
      versions.set(key(dependency), await version(dependency));
    return new WatchDependencySnapshot(versions);
  }

  /** Returns whether two snapshots cover the same dependencies at the same versions. */
  public equals(other: WatchDependencySnapshot): boolean {
    if (this.versions.size !== other.versions.size) return false;
    for (const [location, value] of this.versions)
      if (other.versions.get(location) !== value) return false;
    return true;
  }

  /** Returns a subset only when all requested dependencies were captured by this stable baseline. */
  public select(
    dependencies: IEvidenceSourceDependency[],
  ): WatchDependencySnapshot {
    const selected = new Map<string, string>();
    for (const dependency of dependencies) {
      const location = key(dependency);
      const value = this.versions.get(location);
      if (value === undefined)
        throw new Error(
          `Watch dependency '${dependency.path}' was not captured.`,
        );
      selected.set(location, value);
    }
    return new WatchDependencySnapshot(selected);
  }
}

/** Reads a stable watch value without throwing on ordinary filesystem disappearance. */
async function version(dependency: IEvidenceSourceDependency): Promise<string> {
  let link: BigIntStats;
  try {
    link = await lstat(dependency.path, { bigint: true });
  } catch (cause) {
    return failure(cause);
  }

  const values = [metadata(link)];
  let followed = link;
  if (link.isSymbolicLink()) {
    try {
      values.push(`link:${await readlink(dependency.path)}`);
      values.push(`real:${await realpath(dependency.path)}`);
      followed = await stat(dependency.path, { bigint: true });
      values.push(metadata(followed));
    } catch (cause) {
      values.push(failure(cause));
      return values.join("\u0001");
    }
  }
  try {
    if (followed.isFile())
      values.push(
        `content:${createHash("sha256")
          .update(await readFile(dependency.path))
          .digest("hex")}`,
      );
    else if (followed.isDirectory() && dependency.recursive)
      values.push(
        `entries:${(await readdir(dependency.path, { withFileTypes: true }))
          .sort(compareEntries)
          .map(entryVersion)
          .join("\u0000")}`,
      );
  } catch (cause) {
    values.push(failure(cause));
  }
  return values.join("\u0001");
}

/** Serializes metadata fields whose change can affect filesystem resolution or reads. */
function metadata(info: BigIntStats): string {
  return [
    info.mode,
    info.size,
    info.mtimeNs,
    info.ctimeNs,
    info.dev,
    info.ino,
  ].join(":");
}

/** Encodes a directory entry's name and coarse type for recursive invalidation. */
function entryVersion(entry: Dirent): string {
  const kind = entry.isDirectory()
    ? "directory"
    : entry.isFile()
      ? "file"
      : entry.isSymbolicLink()
        ? "link"
        : "other";
  return `${kind}:${entry.name}`;
}

/** Sorts directory entries before hashing-independent concatenation. */
function compareEntries(left: Dirent, right: Dirent): number {
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
}

/** Distinguishes exact and recursive observations of the same path. */
function key(dependency: IEvidenceSourceDependency): string {
  return `${dependency.recursive ? "recursive" : "exact"}:${dependency.path}`;
}

/** Turns a failed read into versioned state so repair triggers a distinct snapshot. */
function failure(cause: unknown): string {
  return `error:${errorCode(cause)}:${errorMessage(cause)}`;
}

/** Extracts platform error codes without assuming every thrown value is an Error. */
function errorCode(cause: unknown): string {
  if (!(cause instanceof Error) || !("code" in cause)) return "UNKNOWN";
  const code: unknown = cause.code;
  return typeof code === "string" ? code : "UNKNOWN";
}

/** Preserves a human-readable failure component for otherwise opaque watch changes. */
function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
