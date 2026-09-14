import type { IEvidenceSourceDependency } from "./IEvidenceSourceDependency";
import type { IEvidenceSourceDiagnostic } from "./IEvidenceSourceDiagnostic";
import type { IEvidenceSourceFile } from "./IEvidenceSourceFile";
import type { IEvidenceSourceRoot } from "./IEvidenceSourceRoot";

/**
 * Captured discovery result for one configured source selection.
 *
 * The loader resolves a root, applies ordered globs, reads files, and deduplicates
 * physical identities while preserving logical addresses. Adapters consume this
 * snapshot so declaration positions and content come from the same source revision.
 *
 * Dependencies include locations needed to observe new files and repairs.
 * Diagnostics and completeness distinguish an empty successful selection from a
 * failed discovery that happened to return no files; adapters must retain that
 * distinction instead of treating either state as a passing empty inventory.
 */
export interface IEvidenceSourceSnapshot {
  /**
   * Configured and resolved root shared by the population's logical addresses.
   *
   * It retains the authored spelling even when physical directory resolution
   * fails, keeping diagnostics and recovery dependencies attributable.
   */
  root: IEvidenceSourceRoot;

  /**
   * Captured physical files ordered by their first selected address.
   *
   * The list can be partial after failure. Inspect `complete` before treating it
   * as the full source population, even when some files were loaded successfully.
   */
  files: IEvidenceSourceFile[];

  /**
   * Existing and missing filesystem locations needed for invalidation.
   *
   * Directories and absent paths preserve discovery topology, allowing watch to
   * observe newly selected files and recovery from failed reads.
   */
  dependencies: IEvidenceSourceDependency[];

  /**
   * Discovery findings retained alongside any successfully captured files.
   *
   * The list remains meaningful when no file could be read. Adapters translate
   * these findings into inventory diagnostics rather than discarding them.
   */
  diagnostics: IEvidenceSourceDiagnostic[];

  /**
   * Whether discovery completed without failures.
   *
   * An empty successful glob selection remains complete. Missing roots, unreadable
   * files, or other discovery failures cannot be concealed by an empty file list.
   */
  complete: boolean;
}
