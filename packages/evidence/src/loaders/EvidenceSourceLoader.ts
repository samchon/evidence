import { EvidenceFileGlob } from "../internal/EvidenceFileGlob";
import { EvidenceSourceCollector } from "../internal/EvidenceSourceCollector";
import type { IEvidenceSourceSelection } from "../structures/IEvidenceSourceSelection";
import type { IEvidenceSourceSnapshot } from "../structures/IEvidenceSourceSnapshot";

/**
 * Loads source snapshots that adapter analysis can classify and parse.
 *
 * Configuration planning supplies a selection, then the checker uses this
 * boundary to preserve both discovered files and recoverable filesystem
 * failures. The loader does not decide language support: selected unsupported
 * files remain in the snapshot so the applicable adapter can produce its own
 * diagnostic.
 *
 * @example
 *   const snapshot: IEvidenceSourceSnapshot =
 *     await EvidenceSourceLoader.glob("Evidence.config.ts", {
 *       files: ["src/*.ts"],
 *     });
 */
export namespace EvidenceSourceLoader {
  /**
   * Discovers every path selected by one enabled population.
   *
   * Relative patterns and the optional root are anchored to `configFile`.
   * Invalid selector syntax rejects before scanning, while read, traversal, and
   * snapshot failures are collected in an incomplete result. This distinction
   * lets graph evaluation fail safely without losing paths needed for watch
   * recovery.
   */
  export async function glob(
    configFile: string,
    selection: IEvidenceSourceSelection,
  ): Promise<IEvidenceSourceSnapshot> {
    const globs = new EvidenceFileGlob(selection.files);
    const collector = new EvidenceSourceCollector(
      configFile,
      selection.root ?? ".",
    );
    await collector.scan(globs);
    return collector.snapshot();
  }

  /**
   * Captures one exact local file for an operation that names a path directly.
   *
   * The file may be outside `root`, unlike a glob population. Its resolved root
   * still supplies configuration-relative identity and location context, and
   * any filesystem failure is retained in the returned incomplete snapshot.
   */
  export async function file(
    configFile: string,
    file: string,
    root: string = ".",
  ): Promise<IEvidenceSourceSnapshot> {
    const collector = new EvidenceSourceCollector(configFile, root);
    await collector.exact(file);
    return collector.snapshot();
  }
}
