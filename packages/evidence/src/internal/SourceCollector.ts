import { createHash } from "node:crypto";
import type { BigIntStats } from "node:fs";
import {
  lstat,
  open,
  readdir,
  readlink,
  realpath,
  stat,
} from "node:fs/promises";
import path from "node:path";

import type { IEvidenceSourceAddress } from "../structures/IEvidenceSourceAddress";
import type { IEvidenceSourceDependency } from "../structures/IEvidenceSourceDependency";
import type { IEvidenceSourceDiagnostic } from "../structures/IEvidenceSourceDiagnostic";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IEvidenceSourceRoot } from "../structures/IEvidenceSourceRoot";
import type { IEvidenceSourceSnapshot } from "../structures/IEvidenceSourceSnapshot";
import type { FileGlob } from "./FileGlob";
import { SourceFailure } from "./SourceFailure";
import { SourcePath } from "./SourcePath";

/**
 * Collects one configured filesystem population into a stable source snapshot.
 *
 * Logical aliases remain attached to a single physical file identity, while
 * dependency tracking retains intermediate paths so watch mode can recover from
 * missing files, symlink changes, and read failures.
 */
export class SourceCollector {
  private readonly directory: string;
  private readonly root: IEvidenceSourceRoot;
  private readonly files = new Map<string, IEvidenceSourceFile>();
  private readonly versions = new Map<string, string>();
  private readonly dependencies = new Map<string, IEvidenceSourceDependency>();
  private readonly diagnostics: IEvidenceSourceDiagnostic[] = [];

  /** Resolves one declared root relative to its configuration file without accessing it yet. */
  public constructor(configFile: string, declared: string) {
    this.directory = path.dirname(path.resolve(configFile));
    const absolute = SourcePath.root(configFile, declared);
    this.root = {
      declared,
      absolute,
      display: SourcePath.display(this.directory, absolute),
    };
  }

  /** Recursively discovers files selected by ordered globs and records any root failure. */
  public async scan(globs: FileGlob): Promise<void> {
    this.watch(this.root.absolute, true);
    try {
      const physical = await this.resolvePhysical(this.root.absolute);
      const info = await stat(physical, { bigint: true });
      if (!info.isDirectory())
        throw new Error("The population root is not a directory.");
      this.root.physical = physical;
      this.watch(physical, true);
      await this.walk(this.root.absolute, "", physical, info, globs, new Set());
    } catch (cause) {
      this.report("root-unreadable", this.root.absolute, cause);
    }
  }

  /** Loads one exact local source path, retaining its failed path as a watch dependency. */
  public async exact(file: string): Promise<void> {
    if (/^https?:\/\//i.test(file))
      throw new Error(
        "The filesystem source loader accepts local files; remote documents require their adapter.",
      );
    const absolute = SourcePath.resolve(this.root.absolute, file);
    this.watch(absolute, false);
    this.watch(SourcePath.slash(path.dirname(absolute)), false);
    try {
      const physical = await this.resolvePhysical(absolute);
      const info = await stat(physical, { bigint: true });
      if (!info.isFile())
        throw new SourceFailure(
          "not-file",
          "The selected path is not a regular file.",
        );
      await this.read(
        absolute,
        SourcePath.display(this.root.absolute, absolute),
        physical,
        info,
      );
    } catch (cause) {
      this.report("path-unreadable", absolute, cause);
    }
  }

  /** Returns deterministic collected files, dependencies, and diagnostics for one analysis pass. */
  public snapshot(): IEvidenceSourceSnapshot {
    const files = [...this.files.values()];
    for (const file of files)
      file.addresses.sort((left, right) =>
        compare(left.relative, right.relative),
      );
    files.sort((left, right) =>
      compare(
        left.addresses[0]?.relative ?? left.physicalPath,
        right.addresses[0]?.relative ?? right.physicalPath,
      ),
    );
    return {
      root: this.root,
      files,
      dependencies: [...this.dependencies.values()].sort((left, right) =>
        compare(left.path, right.path),
      ),
      diagnostics: this.diagnostics,
      complete: this.diagnostics.length === 0,
    };
  }

  /** Walks a physical directory through its logical address while preventing symlink ancestry cycles. */
  private async walk(
    absolute: string,
    relative: string,
    physical: string,
    info: BigIntStats,
    globs: FileGlob,
    ancestors: ReadonlySet<string>,
  ): Promise<void> {
    const id = identity(info, physical);
    if (ancestors.has(id))
      throw new SourceFailure(
        "symlink-cycle",
        "A directory link returns to an ancestor; remove the cycle or exclude this subtree.",
      );
    this.watch(absolute, true);
    this.watch(physical, true);
    const next = new Set(ancestors);
    next.add(id);
    const entries = (await readdir(physical)).sort(compare);
    for (const name of entries) {
      const location = relative === "" ? name : relative + "/" + name;
      const selected = globs.matches(location);
      const descend = globs.couldMatchDescendant(location);
      if (!selected && !descend) continue;
      const filename = SourcePath.slash(path.join(absolute, name));
      const target = SourcePath.slash(path.join(physical, name));
      this.watch(filename, false);
      this.watch(target, false);
      try {
        // readdir supplies exact names under an already resolved parent.
        const entry = await lstat(target, { bigint: true });
        const linked = entry.isSymbolicLink();
        const resolved = linked
          ? await this.resolvePhysical(target, new Set(), false)
          : target;
        const metadata = linked
          ? await stat(resolved, { bigint: true })
          : entry;
        if (metadata.isDirectory()) {
          if (descend)
            await this.walk(
              filename,
              location,
              resolved,
              metadata,
              globs,
              next,
            );
        } else if (selected) {
          if (!metadata.isFile())
            throw new SourceFailure(
              "not-file",
              "The selected path is not a regular file.",
            );
          await this.read(filename, location, resolved, metadata);
        }
      } catch (cause) {
        this.report("path-unreadable", filename, cause);
      }
    }
  }

  /** Reads one stable physical file, coalescing aliases only after stat-before/stat-after validation. */
  private async read(
    absolute: string,
    relative: string,
    physical: string,
    info: BigIntStats,
  ): Promise<void> {
    this.watch(absolute, false);
    this.watch(physical, false);
    const address: IEvidenceSourceAddress = {
      absolute,
      relative,
      display: SourcePath.display(this.directory, absolute),
    };
    const id = identity(info, physical);
    const existing = this.files.get(id);
    if (existing !== undefined) {
      if (this.versions.get(id) !== version(info))
        throw new SourceFailure(
          "source-changed",
          "The file changed between selected aliases; retry discovery.",
        );
      existing.addresses.push(address);
      return;
    }
    const handle = await open(physical, "r");
    try {
      const before = await handle.stat({ bigint: true });
      const bytes = await handle.readFile();
      const after = await handle.stat({ bigint: true });
      if (
        identity(before, physical) !== id ||
        before.size !== after.size ||
        before.mtimeNs !== after.mtimeNs ||
        before.ctimeNs !== after.ctimeNs ||
        BigInt(bytes.length) !== after.size
      )
        throw new SourceFailure(
          "source-changed",
          "The file changed while it was being read; retry discovery.",
        );
      let content: string;
      try {
        content = new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true,
        }).decode(bytes);
      } catch {
        throw new SourceFailure(
          "invalid-encoding",
          "The selected file is not valid UTF-8; save it as UTF-8 or correct the files selection.",
        );
      }
      this.files.set(id, {
        id,
        physicalPath: physical,
        content,
        digest: createHash("sha256").update(bytes).digest("hex"),
        addresses: [address],
      });
      this.versions.set(id, version(after));
    } finally {
      await handle.close();
    }
  }

  /** Resolves each symlink component while tracking links and enforcing configured path casing. */
  private async resolvePhysical(
    absolute: string,
    links: ReadonlySet<string> = new Set(),
    checkCase: boolean = true,
  ): Promise<string> {
    const parsed = path.parse(absolute);
    let current = parsed.root;
    const segments = absolute
      .slice(parsed.root.length)
      .split(/[\\/]/)
      .filter((part) => part !== "");
    for (const segment of segments) {
      this.watch(SourcePath.slash(current), false);
      if (checkCase) {
        const names = await readdir(current);
        if (!names.includes(segment)) {
          const actual = names.find(
            (name) => name.toLowerCase() === segment.toLowerCase(),
          );
          if (actual !== undefined)
            throw new SourceFailure(
              "case-mismatch",
              `Path segment '${segment}' is spelled '${actual}' on disk; use that exact case.`,
            );
        }
      }
      current = path.join(current, segment);
      this.watch(SourcePath.slash(current), false);
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) {
        if (links.has(current))
          throw new SourceFailure(
            "symlink-cycle",
            "The selected path contains a cyclic symbolic link.",
          );
        const next = new Set(links);
        next.add(current);
        current = await this.resolvePhysical(
          path.resolve(path.dirname(current), await readlink(current)),
          next,
          false,
        );
      }
    }
    return SourcePath.slash(await realpath(current));
  }

  /** Merges a dependency observation, retaining recursive monitoring when any consumer requires it. */
  private watch(location: string, recursive: boolean): void {
    const existing = this.dependencies.get(location);
    this.dependencies.set(location, {
      path: location,
      recursive: recursive || existing?.recursive === true,
    });
  }

  /** Converts an expected collection failure into a retained diagnostic instead of aborting sibling paths. */
  private report(
    fallback: IEvidenceSourceDiagnostic["code"],
    location: string,
    cause: unknown,
  ): void {
    const message = cause instanceof Error ? cause.message : String(cause);
    this.diagnostics.push({
      code: cause instanceof SourceFailure ? cause.code : fallback,
      path: location,
      message: `Could not discover '${location}': ${message}`,
    });
  }
}

/** Uses stable device/inode identity where available, falling back to the resolved path on filesystems without it. */
function identity(info: BigIntStats, physical: string): string {
  return info.ino === 0n ? "path:" + physical : `file:${info.dev}:${info.ino}`;
}

/** Sorts filesystem names without locale rules so snapshots are cross-machine stable. */
function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Encodes metadata needed to detect a changed file seen through a second alias. */
function version(info: BigIntStats): string {
  return `${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
}
