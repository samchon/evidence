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

/** Immutable filesystem versions used to detect and validate watch cycles. */
export class WatchDependencySnapshot {
  private constructor(private readonly versions: ReadonlyMap<string, string>) {}

  public static async capture(
    dependencies: IEvidenceSourceDependency[],
  ): Promise<WatchDependencySnapshot> {
    const versions = new Map<string, string>();
    for (const dependency of dependencies)
      versions.set(key(dependency), await version(dependency));
    return new WatchDependencySnapshot(versions);
  }

  public equals(other: WatchDependencySnapshot): boolean {
    if (this.versions.size !== other.versions.size) return false;
    for (const [location, value] of this.versions)
      if (other.versions.get(location) !== value) return false;
    return true;
  }

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

function compareEntries(left: Dirent, right: Dirent): number {
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
}

function key(dependency: IEvidenceSourceDependency): string {
  return `${dependency.recursive ? "recursive" : "exact"}:${dependency.path}`;
}

function failure(cause: unknown): string {
  return `error:${errorCode(cause)}:${errorMessage(cause)}`;
}

function errorCode(cause: unknown): string {
  if (!(cause instanceof Error) || !("code" in cause)) return "UNKNOWN";
  const code: unknown = cause.code;
  return typeof code === "string" ? code : "UNKNOWN";
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
