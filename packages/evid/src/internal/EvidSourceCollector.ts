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

import type { IEvidSourceAddress } from "../structures/IEvidSourceAddress";
import type { IEvidSourceDependency } from "../structures/IEvidSourceDependency";
import type { IEvidSourceDiagnostic } from "../structures/IEvidSourceDiagnostic";
import type { IEvidSourceFile } from "../structures/IEvidSourceFile";
import type { IEvidSourceRoot } from "../structures/IEvidSourceRoot";
import type { IEvidSourceSnapshot } from "../structures/IEvidSourceSnapshot";
import type { EvidFileGlob } from "./EvidFileGlob";
import { EvidSourceFailure } from "./EvidSourceFailure";
import { EvidSourcePath } from "./EvidSourcePath";

/**
 * Collects one configured filesystem population into a stable source snapshot.
 *
 * Logical aliases remain attached to a single physical file identity, while
 * dependency tracking retains intermediate paths so watch mode can recover from
 * missing files, symlink changes, and read failures.
 */
export class EvidSourceCollector {
  private readonly directory: string;
  private readonly root: IEvidSourceRoot;
  private readonly files = new Map<string, IEvidSourceFile>();
  private readonly versions = new Map<string, string>();
  private readonly dependencies = new Map<string, IEvidSourceDependency>();
  private readonly diagnostics: IEvidSourceDiagnostic[] = [];

  /**
   * Initializes collection for one declared root relative to its configuration file.
   *
   * Construction records lexical and display paths only; scanning later resolves
   * the filesystem so a caller can configure globs before any access occurs.
   */
  public constructor(configFile: string, declared: string) {
    this.directory = path.dirname(path.resolve(configFile));
    const absolute = EvidSourcePath.root(configFile, declared);
    this.root = {
      declared,
      absolute,
      display: EvidSourcePath.display(this.directory, absolute),
    };
  }

  /**
   * Recursively discovers files selected by ordered globs and records root failures.
   *
   * The collector retains failed root paths as dependencies so watch mode can
   * observe the repair instead of requiring a configuration edit.
   */
  public async scan(globs: EvidFileGlob): Promise<void> {
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

  /**
   * Loads one exact local source path and retains failures as watch dependencies.
   *
   * Exact selection rejects remote URLs and reports filesystem errors without
   * aborting sibling source collection work.
   */
  public async exact(file: string): Promise<void> {
    if (/^https?:\/\//i.test(file))
      throw new Error(
        "The filesystem source loader accepts local files; remote documents require their adapter.",
      );
    const absolute = EvidSourcePath.resolve(this.root.absolute, file);
    this.watch(absolute, false);
    this.watch(EvidSourcePath.slash(path.dirname(absolute)), false);
    try {
      const rootPhysical: string = await this.resolvePhysical(
        this.root.absolute,
      );
      const rootInfo: BigIntStats = await stat(rootPhysical, { bigint: true });
      if (!rootInfo.isDirectory())
        throw new EvidSourceFailure(
          "root-unreadable",
          "The population root is not a directory.",
        );
      this.root.physical = rootPhysical;
      this.watch(rootPhysical, true);
      const physical = await this.resolvePhysical(absolute);
      const info = await stat(physical, { bigint: true });
      if (!info.isFile())
        throw new EvidSourceFailure(
          "not-file",
          "The selected path is not a regular file.",
        );
      await this.read(
        absolute,
        EvidSourcePath.display(this.root.absolute, absolute),
        physical,
        info,
      );
    } catch (cause) {
      this.report("path-unreadable", absolute, cause);
    }
  }

  /**
   * Returns collected files, dependencies, and diagnostics for one analysis pass.
   *
   * Addresses, files, and dependencies are sorted with bytewise comparisons so
   * equivalent source snapshots do not vary with filesystem traversal order.
   */
  public snapshot(): IEvidSourceSnapshot {
    const files: IEvidSourceFile[] = [...this.files.values()];
    for (const file of files) {
      file.addresses.sort((left, right) =>
        compare(left.relative, right.relative),
      );
      const declaring: IEvidSourceAddress | undefined = file.addresses[0];
      if (declaring !== undefined) file.fingerprintPath = declaring.display;
    }
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

  /**
   * Walks a physical directory through its logical address while preventing symlink cycles.
   *
   * The traversal retains both spellings: logical paths form public addresses,
   * while physical identity detects recursive links and duplicate files.
   */
  private async walk(
    absolute: string,
    relative: string,
    physical: string,
    info: BigIntStats,
    globs: EvidFileGlob,
    ancestors: ReadonlySet<string>,
  ): Promise<void> {
    const id = identity(info, physical);
    if (ancestors.has(id))
      throw new EvidSourceFailure(
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
      const filename = EvidSourcePath.slash(path.join(absolute, name));
      const target = EvidSourcePath.slash(path.join(physical, name));
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
            throw new EvidSourceFailure(
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

  /**
   * Reads one stable physical file after validating metadata before and after I/O.
   *
   * Alias addresses coalesce only when their device and inode version remains
   * stable, preventing a changing file from yielding an incoherent snapshot.
   */
  private async read(
    absolute: string,
    relative: string,
    physical: string,
    info: BigIntStats,
  ): Promise<void> {
    this.watch(absolute, false);
    this.watch(physical, false);
    const address: IEvidSourceAddress = {
      absolute,
      relative,
      display: EvidSourcePath.display(this.directory, absolute),
    };
    const id = identity(info, physical);
    const existing = this.files.get(id);
    if (existing !== undefined) {
      if (this.versions.get(id) !== version(info))
        throw new EvidSourceFailure(
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
        throw new EvidSourceFailure(
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
        throw new EvidSourceFailure(
          "invalid-encoding",
          "The selected file is not valid UTF-8; save it as UTF-8 or correct the files selection.",
        );
      }
      this.files.set(id, {
        id,
        physicalPath: physical,
        fingerprintPath: address.display,
        ...(this.root.physical === undefined
          ? {}
          : {
              fingerprintRoot: {
                physicalPath: this.root.physical,
                fingerprintPath: this.root.display,
              },
            }),
        content,
        digest: createHash("sha256").update(bytes).digest("hex"),
        addresses: [address],
      });
      this.versions.set(id, version(after));
    } finally {
      await handle.close();
    }
  }

  /**
   * Resolves each symlink component while tracking links and configured path casing.
   *
   * Exact-case validation protects portable source identities, and link tracking
   * reports cycles before recursive filesystem resolution can loop.
   */
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
      this.watch(EvidSourcePath.slash(current), false);
      if (checkCase) {
        const names = await readdir(current);
        if (!names.includes(segment)) {
          const actual = names.find(
            (name) => name.toLowerCase() === segment.toLowerCase(),
          );
          if (actual !== undefined)
            throw new EvidSourceFailure(
              "case-mismatch",
              `Path segment '${segment}' is spelled '${actual}' on disk; use that exact case.`,
            );
        }
      }
      current = path.join(current, segment);
      this.watch(EvidSourcePath.slash(current), false);
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) {
        if (links.has(current))
          throw new EvidSourceFailure(
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
    return EvidSourcePath.slash(await realpath(current));
  }

  /**
   * Merges a dependency observation and retains recursive monitoring when required.
   *
   * Multiple reads of one path share a dependency record; any directory consumer
   * can promote it to recursive watching without losing earlier observations.
   */
  private watch(location: string, recursive: boolean): void {
    const existing = this.dependencies.get(location);
    this.dependencies.set(location, {
      path: location,
      recursive: recursive || existing?.recursive === true,
    });
  }

  /**
   * Converts an expected collection failure into a retained diagnostic.
   *
   * Sibling paths continue scanning, while `EvidSourceFailure` preserves its specific
   * diagnostic code instead of becoming the caller-supplied fallback category.
   */
  private report(
    fallback: IEvidSourceDiagnostic["code"],
    location: string,
    cause: unknown,
  ): void {
    const message = cause instanceof Error ? cause.message : String(cause);
    this.diagnostics.push({
      code: cause instanceof EvidSourceFailure ? cause.code : fallback,
      path: location,
      message: `Could not discover '${location}': ${message}`,
    });
  }
}

/**
 * Produces stable file identity from device and inode metadata when available.
 *
 * Source collection falls back to the resolved physical path on filesystems
 * without inode support, allowing aliases to coalesce consistently per host.
 */
function identity(info: BigIntStats, physical: string): string {
  return info.ino === 0n ? "path:" + physical : `file:${info.dev}:${info.ino}`;
}

/**
 * Sorts filesystem names without locale rules.
 *
 * Bytewise ordering keeps source snapshots stable across machines whose locale
 * settings would otherwise order the same directory entries differently.
 */
function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Encodes metadata needed to detect a file changed through a second alias.
 *
 * Alias coalescing compares this value before accepting another address for a
 * file already captured in the current source snapshot.
 */
function version(info: BigIntStats): string {
  return `${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
}
