import type { IEvidenceCheckAnalysis } from "../structures/IEvidenceCheckAnalysis";
import type { IEvidenceSourceDependency } from "../structures/IEvidenceSourceDependency";

import { SourcePath } from "./SourcePath";

/** Builds deterministic active watch sets from configuration and inventory inputs. */
export namespace WatchDependencySet {
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

  export function merge(
    ...groups: IEvidenceSourceDependency[][]
  ): IEvidenceSourceDependency[] {
    const output = new Map<string, IEvidenceSourceDependency>();
    for (const dependency of groups.flat()) {
      const location = SourcePath.slash(dependency.path);
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
