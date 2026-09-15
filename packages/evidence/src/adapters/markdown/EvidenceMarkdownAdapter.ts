import typia from "typia";

import { EvidenceInventory } from "../../graph/EvidenceInventory";
import { EvidenceMarkdownScanner } from "./EvidenceMarkdownScanner";
import type { IEvidenceAdapter } from "../../structures/IEvidenceAdapter";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";
import type { IEvidenceSourceSnapshot } from "../../structures/IEvidenceSourceSnapshot";

/**
 * Extracts Markdown file and heading units with HTML-comment annotation hosts.
 *
 * Every supplied source is interpreted as Markdown regardless of its extension.
 * EvidenceMarkdownScanner owns heading hierarchy, fenced-content boundaries, and
 * comment attachment; this adapter combines those records with discovery
 * diagnostics and validates the resulting shared inventory.
 */
export class EvidenceMarkdownAdapter implements IEvidenceAdapter<"markdown"> {
  /**
   * Artifact discriminator selecting Markdown structure and target grammar.
   *
   * Population symbol policies can select files or supported exact heading
   * levels.
   */
  public get type(): "markdown" {
    return "markdown";
  }

  /**
   * Scans captured Markdown contents into an owned normalized inventory.
   *
   * Input is validated and cloned before scanners append units and annotations.
   * Discovery failures remain attached to the result, preventing unreadable
   * files from silently reducing the coverage population.
   */
  public async analyze(snapshot: IEvidenceSourceSnapshot): Promise<IEvidenceInventory> {
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
      new EvidenceMarkdownScanner(inventory, source).scan();
    return new EvidenceInventory([inventory]).snapshot();
  }
}
