import type {
  IEvidenceSourceDiagnostic,
  IEvidenceSourceSnapshot,
} from "@wrtnlabs/evidence";
import { createHash } from "node:crypto";

/** Builds deterministic in-memory discovery results for adapter logic tests. */
export namespace TestSourceSnapshot {
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

  export function fail(
    snapshot: IEvidenceSourceSnapshot,
    diagnostic: IEvidenceSourceDiagnostic,
  ): IEvidenceSourceSnapshot {
    snapshot.complete = false;
    snapshot.diagnostics.push(diagnostic);
    return snapshot;
  }
}
