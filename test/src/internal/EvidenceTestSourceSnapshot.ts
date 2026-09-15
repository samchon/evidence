import type {
  IEvidenceSourceDiagnostic,
  IEvidenceSourceSnapshot,
} from "evidence";
import { createHash } from "node:crypto";

/**
 * Builds deterministic in-memory discovery results for adapter logic tests.
 *
 * Fixtures receive stable physical and fingerprint paths while retaining the
 * same snapshot shape returned by filesystem discovery.
 */
export namespace EvidenceTestSourceSnapshot {
  /**
   * Combines fixture sources under the first snapshot's configured root.
   *
   * Files, dependencies, and diagnostics retain input order, while completeness
   * fails if any contributing snapshot is incomplete. An empty input is invalid
   * because it cannot supply root identity.
   */
  export function combine(
    snapshots: IEvidenceSourceSnapshot[],
  ): IEvidenceSourceSnapshot {
    const first = snapshots[0];
    if (first === undefined)
      throw new Error("At least one source snapshot is required.");
    return {
      root: first.root,
      files: snapshots.flatMap((snapshot) => snapshot.files),
      dependencies: snapshots.flatMap((snapshot) => snapshot.dependencies),
      diagnostics: snapshots.flatMap((snapshot) => snapshot.diagnostics),
      complete: snapshots.every((snapshot) => snapshot.complete),
    };
  }

  /**
   * Creates one in-memory source with deterministic discovery metadata.
   *
   * The logical relative path also supplies the checkout-stable fingerprint
   * identity, while aliases remain separate public addresses for resolution
   * tests.
   */
  export function create(
    relative: string,
    content: string,
    aliases: string[] = [relative],
    root: string = "/project",
  ): IEvidenceSourceSnapshot {
    return {
      root: {
        declared: ".",
        absolute: root,
        physical: root,
        display: ".",
      },
      files: [
        {
          id: `source:${relative}`,
          physicalPath: `${root}/${relative}`,
          fingerprintPath: relative,
          fingerprintRoot: {
            physicalPath: root,
            fingerprintPath: ".",
          },
          content,
          digest: createHash("sha256").update(content).digest("hex"),
          addresses: aliases.map((alias) => ({
            absolute: `${root}/${alias}`,
            relative: alias,
            display: alias,
          })),
        },
      ],
      dependencies: [],
      diagnostics: [],
      complete: true,
    };
  }

  /**
   * Marks a fixture snapshot incomplete with one source diagnostic.
   *
   * Failure tests use the same mutable transition produced by filesystem
   * discovery so adapters cannot mistake a missing population for an empty
   * one.
   */
  export function fail(
    snapshot: IEvidenceSourceSnapshot,
    diagnostic: IEvidenceSourceDiagnostic,
  ): IEvidenceSourceSnapshot {
    snapshot.complete = false;
    snapshot.diagnostics.push(diagnostic);
    return snapshot;
  }
}
