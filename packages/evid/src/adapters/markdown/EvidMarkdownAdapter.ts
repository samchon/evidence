import typia from "typia";

import { EvidInventory } from "../../graph/EvidInventory";
import { EvidMarkdownScanner } from "./EvidMarkdownScanner";
import type { IEvidAdapter } from "../../structures/IEvidAdapter";
import type { IEvidInventory } from "../../structures/IEvidInventory";
import type { IEvidSourceSnapshot } from "../../structures/IEvidSourceSnapshot";
import type { EvidArtifactType } from "../../typings/EvidArtifactType";

/**
 * Extracts Markdown file and heading units with HTML-comment annotation hosts.
 *
 * Every supplied source is interpreted as Markdown regardless of its extension.
 * EvidMarkdownScanner owns heading hierarchy, fenced-content boundaries, and
 * comment attachment; this adapter combines those records with discovery
 * diagnostics and validates the resulting shared inventory.
 */
export class EvidMarkdownAdapter implements IEvidAdapter {
  /**
   * Artifact discriminator selecting Markdown structure and target grammar.
   *
   * Population symbol policies can select files or supported exact heading
   * levels.
   */
  public readonly type: EvidArtifactType = "markdown";

  /**
   * Scans captured Markdown contents into an owned normalized inventory.
   *
   * Input is validated and cloned before scanners append units and annotations.
   * Discovery failures remain attached to the result, preventing unreadable
   * files from silently reducing the coverage population.
   */
  public async analyze(snapshot: IEvidSourceSnapshot): Promise<IEvidInventory> {
    const input = structuredClone(typia.assert(snapshot));
    const inventory: IEvidInventory = {
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
      new EvidMarkdownScanner(inventory, source).scan();
    return new EvidInventory([inventory]).snapshot();
  }
}
