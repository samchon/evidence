import { FileGlob } from "./internal/FileGlob";
import { SourceCollector } from "./internal/SourceCollector";
import type { IEvidenceSourceSelection } from "./structures/IEvidenceSourceSelection";
import type { IEvidenceSourceSnapshot } from "./structures/IEvidenceSourceSnapshot";

/** Loads local source bytes before adapters classify and parse selected files. */
export namespace EvidenceSourceLoader {
  /**
   * Discovers an enabled population relative to its configuration file.
   * Retains every selected file; adapters must diagnose unsupported formats.
   * Invalid selections throw; filesystem failures return an incomplete snapshot.
   */
  export async function glob(
    configFile: string,
    selection: IEvidenceSourceSelection,
  ): Promise<IEvidenceSourceSnapshot> {
    const globs = new FileGlob(selection.files);
    const collector = new SourceCollector(configFile, selection.root ?? ".");
    await collector.scan(globs);
    return collector.snapshot();
  }

  /** Loads one exact local path, including files outside the population root. */
  export async function file(
    configFile: string,
    file: string,
    root: string = ".",
  ): Promise<IEvidenceSourceSnapshot> {
    const collector = new SourceCollector(configFile, root);
    await collector.exact(file);
    return collector.snapshot();
  }
}
