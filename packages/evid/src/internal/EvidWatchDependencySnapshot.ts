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

import type { IEvidSourceDependency } from "../structures/IEvidSourceDependency";

/**
 * Immutable filesystem versions used to validate a watch attempt before
 * publication.
 *
 * Versions include symlink and directory-entry state because either can change
 * which source is read; a content-only check would miss resolution changes.
 */
export class EvidWatchDependencySnapshot {
  /**
   * Creates a snapshot from already captured dependency version strings.
   *
   * Capture and select are the only constructors because callers must not
   * invent values that would falsely validate a watch attempt.
   */
  private constructor(private readonly versions: ReadonlyMap<string, string>) {}

  /**
   * Captures every dependency asynchronously, encoding inaccessible paths as
   * observable failures.
   *
   * Watch publication compares this baseline with a later capture so deletion,
   * permission failure, and repair all count as distinct filesystem states.
   */
  public static async capture(
    dependencies: IEvidSourceDependency[],
  ): Promise<EvidWatchDependencySnapshot> {
    const versions = new Map<string, string>();
    for (const dependency of dependencies)
      versions.set(key(dependency), await version(dependency));
    return new EvidWatchDependencySnapshot(versions);
  }

  /**
   * States whether two snapshots cover the same dependencies at the same
   * versions.
   *
   * Watch attempts publish only when this equality holds, preventing output
   * from describing a source state that changed during analysis.
   */
  public equals(other: EvidWatchDependencySnapshot): boolean {
    if (this.versions.size !== other.versions.size) return false;
    for (const [location, value] of this.versions)
      if (other.versions.get(location) !== value) return false;
    return true;
  }

  /**
   * Returns a dependency subset captured by this stable baseline.
   *
   * Every requested key must exist in the baseline; omission throws rather than
   * allowing a narrower snapshot to validate unrelated watch work.
   */
  public select(
    dependencies: IEvidSourceDependency[],
  ): EvidWatchDependencySnapshot {
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
    return new EvidWatchDependencySnapshot(selected);
  }
}

/**
 * Reads a stable watch version without throwing on ordinary filesystem
 * disappearance.
 *
 * Capture uses this value for each dependency so failures become comparable
 * state and a repaired path invalidates the prior failed snapshot.
 */
async function version(dependency: IEvidSourceDependency): Promise<string> {
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

/**
 * Serializes metadata fields whose changes can affect filesystem resolution or
 * reads.
 *
 * File and link versions include this component before content or directory
 * entries so metadata-only replacement is observable to the watch baseline.
 */
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

/**
 * Encodes a directory entry's name and coarse type for recursive invalidation.
 *
 * Recursive directory versions use this value after sorting, so additions,
 * removals, and entry-type changes invalidate the dependency snapshot.
 */
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

/**
 * Sorts directory entries before deterministic concatenation.
 *
 * Filesystem enumeration order is not stable, so version derives the same
 * string for an unchanged recursive directory across captures.
 */
function compareEntries(left: Dirent, right: Dirent): number {
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
}

/**
 * Distinguishes exact and recursive observations of the same filesystem path.
 *
 * Snapshot maps use this key so a file watch cannot be substituted for the
 * broader directory observation required by a recursive dependency.
 */
function key(dependency: IEvidSourceDependency): string {
  return `${dependency.recursive ? "recursive" : "exact"}:${dependency.path}`;
}

/**
 * Turns a failed filesystem read into versioned state.
 *
 * The encoded error lets later repair produce a different snapshot instead of
 * making disappearance invisible to the watch publication check.
 */
function failure(cause: unknown): string {
  return `error:${errorCode(cause)}:${errorMessage(cause)}`;
}

/**
 * Extracts a platform error code without assuming every thrown value is an
 * Error.
 *
 * Failure uses UNKNOWN for non-Error values and errors without string codes so
 * opaque exceptions still become stable observable watch state.
 */
function errorCode(cause: unknown): string {
  if (!(cause instanceof Error) || !("code" in cause)) return "UNKNOWN";
  const code: unknown = cause.code;
  return typeof code === "string" ? code : "UNKNOWN";
}

/**
 * Preserves a human-readable component for otherwise opaque watch failures.
 *
 * Together with errorCode, this distinguishes read failures in snapshot values
 * while retaining useful context for diagnostics and change detection.
 */
function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
