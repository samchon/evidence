import { createHash } from "node:crypto";

import type { IEvidenceSourceDiagnostic } from "../../../packages/evidence/src/structures/IEvidenceSourceDiagnostic";
import type { IEvidenceSourceSnapshot } from "../../../packages/evidence/src/structures/IEvidenceSourceSnapshot";

/** Builds deterministic in-memory discovery results for adapter logic tests. */
export namespace TestSourceSnapshot {
  export function create(
    relative: string,
    content: string,
    aliases: string[] = [relative],
  ): IEvidenceSourceSnapshot {
    return {
      root: {
        declared: ".",
        absolute: "/project",
        physical: "/project",
        display: ".",
      },
      files: [
        {
          id: `source:${relative}`,
          physicalPath: `/project/${relative}`,
          content,
          digest: createHash("sha256").update(content).digest("hex"),
          addresses: aliases.map((alias) => ({
            absolute: `/project/${alias}`,
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
