import { EvidFileGlob } from "../internal/EvidFileGlob";
import { EvidSourceCollector } from "../internal/EvidSourceCollector";
import type { IEvidSourceSelection } from "../structures/IEvidSourceSelection";
import type { IEvidSourceSnapshot } from "../structures/IEvidSourceSnapshot";

/**
 * Loads source snapshots that adapter analysis can classify and parse.
 *
 * Configuration planning supplies a selection, then the checker uses this boundary
 * to preserve both discovered files and recoverable filesystem failures. The
 * loader does not decide language support: selected unsupported files remain in
 * the snapshot so the applicable adapter can produce its own diagnostic.
 *
 * @example
 * const snapshot: IEvidSourceSnapshot = await EvidSourceLoader.glob(
 *   "evid.config.ts",
 *   { files: ["src/*.ts"] },
 * );
 */
export namespace EvidSourceLoader {
  /**
   * Discovers every path selected by one enabled population.
   *
   * Relative patterns and the optional root are anchored to `configFile`. Invalid
   * selector syntax rejects before scanning, while read, traversal, and snapshot
   * failures are collected in an incomplete result. This distinction lets graph
   * evaluation fail safely without losing paths needed for watch recovery.
   */
  export async function glob(
    configFile: string,
    selection: IEvidSourceSelection,
  ): Promise<IEvidSourceSnapshot> {
    const globs = new EvidFileGlob(selection.files);
    const collector = new EvidSourceCollector(configFile, selection.root ?? ".");
    await collector.scan(globs);
    return collector.snapshot();
  }

  /**
   * Captures one exact local file for an operation that names a path directly.
   *
   * The file may be outside `root`, unlike a glob population. Its resolved root
   * still supplies configuration-relative identity and location context, and any
   * filesystem failure is retained in the returned incomplete snapshot.
   */
  export async function file(
    configFile: string,
    file: string,
    root: string = ".",
  ): Promise<IEvidSourceSnapshot> {
    const collector = new EvidSourceCollector(configFile, root);
    await collector.exact(file);
    return collector.snapshot();
  }
}
