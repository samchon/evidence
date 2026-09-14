import typia from "typia";

import { EvidenceInventory } from "../../graph/EvidenceInventory";
import { MarkdownScanner } from "./MarkdownScanner";
import type { IEvidenceAdapter } from "../../structures/IEvidenceAdapter";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";
import type { IEvidenceSourceSnapshot } from "../../structures/IEvidenceSourceSnapshot";
import type { EvidenceArtifactType } from "../../typings/EvidenceArtifactType";

/** Builds Markdown units and HTML-comment annotations in the shared inventory. */
export class EvidenceMarkdownAdapter implements IEvidenceAdapter {
  public readonly type: EvidenceArtifactType = "markdown";

  public async analyze(
    snapshot: IEvidenceSourceSnapshot,
  ): Promise<IEvidenceInventory> {
    const input = structuredClone(typia.assert(snapshot));
    const inventory: IEvidenceInventory = {
      schemaVersion: 1,
      sources: input.files,
      annotationRanges: [],
      units: [],
      addresses: [],
      hosts: [],
      declarations: [],
      reviews: [],
      diagnostics: input.diagnostics.map((diagnostic) => ({
        code: `source-${diagnostic.code}`,
        severity: "error",
        message: diagnostic.message,
        repair:
          "Restore access to the selected Markdown source before evaluating coverage.",
        location: { file: diagnostic.path },
      })),
      dependencies: input.dependencies,
      complete: input.complete,
    };
    for (const source of input.files)
      new MarkdownScanner(inventory, source).scan();
    return new EvidenceInventory([inventory]).snapshot();
  }
}
