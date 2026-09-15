import type { IEvidenceCheckAnalysis } from "../structures/IEvidenceCheckAnalysis";
import type { IEvidenceSourceDependency } from "../structures/IEvidenceSourceDependency";

import { EvidenceSourcePath } from "./EvidenceSourcePath";

/**
 * Builds deterministic watch dependency sets from an analysis snapshot.
 *
 * Merging upgrades duplicate paths to recursive monitoring, preserving the
 * broader invalidation boundary without retaining duplicate watcher requests.
 */
export namespace EvidenceWatchDependencySet {
  /**
   * Combines configuration dependencies with every loaded claim and reference
   * inventory.
   *
   * Watch setup uses the merged result so edits to configuration, selected
   * claims, or selected reference sources can invalidate the published
   * analysis.
   */
  export function analysis(
    value: IEvidenceCheckAnalysis,
    configuration: IEvidenceSourceDependency[],
  ): IEvidenceSourceDependency[] {
    return merge(
      configuration,
      value.graphInput.claims.flatMap((claim) => [
        ...claim.inventory.dependencies,
        ...claim.references.flatMap(
          (reference) => reference.inventory.dependencies,
        ),
      ]),
    );
  }

  /**
   * Normalizes, deduplicates, and orders dependency paths for stable snapshots.
   *
   * Duplicate paths retain recursive monitoring when any source requires it,
   * preserving the broadest invalidation boundary in the returned set.
   */
  export function merge(
    ...groups: IEvidenceSourceDependency[][]
  ): IEvidenceSourceDependency[] {
    const output = new Map<string, IEvidenceSourceDependency>();
    for (const dependency of groups.flat()) {
      const location = EvidenceSourcePath.slash(dependency.path);
      const previous = output.get(location);
      output.set(location, {
        path: location,
        recursive: dependency.recursive || previous?.recursive === true,
      });
    }
    return Array.from(output.values()).sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
  }

  /**
   * Checks whether available dependencies cover every required path at equal or
   * broader recursion.
   *
   * A recursive requirement cannot be satisfied by an exact watch, while a
   * recursive available dependency can satisfy an exact requirement for its
   * path.
   */
  export function contains(
    available: IEvidenceSourceDependency[],
    required: IEvidenceSourceDependency[],
  ): boolean {
    const lookup = new Map(
      available.map((dependency) => [dependency.path, dependency.recursive]),
    );
    return required.every((dependency) => {
      const recursive = lookup.get(dependency.path);
      return recursive !== undefined && (!dependency.recursive || recursive);
    });
  }
}
