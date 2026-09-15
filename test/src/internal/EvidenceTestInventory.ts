import type {
  EvidenceSymbol,
  IEvidenceHost,
  IEvidenceInventory,
  IEvidenceSourceRange,
  IEvidenceUnit,
} from "@wrtnlabs/evidence";
import { dedent } from "@typia/utils";
import { createHash } from "node:crypto";

import { EvidenceSourceText } from "@wrtnlabs/evidence";

/**
 * Builds explicit adapter records independently of language extraction.
 *
 * Graph and fingerprint tests use this namespace when parser behavior would add
 * unrelated variables to the identity, ownership, or source-path scenario.
 */
export namespace EvidenceTestInventory {
  /**
   * Creates an empty graph inventory with one deterministic TypeScript source.
   *
   * Callers add units and hosts directly while the source retains distinct
   * physical, review-fingerprint, and public-address identities.
   */
  export function create(): IEvidenceInventory {
    const content = dedent`
      /** Shared documentation. */
      export const first = 1, second = 2;
      /** Class documentation. */
      export class Box { value = 1; }
      export interface Box { extra: string; }
      export const unrelated = 3;
    `;
    return {
      schemaVersion: 1,
      annotationRanges: [],
      complete: true,
      sources: [
        {
          id: "source",
          physicalPath: "/project/source.ts",
          fingerprintPath: "source.ts",
          content,
          digest: createHash("sha256").update(content).digest("hex"),
          addresses: [
            {
              absolute: "/project/source.ts",
              relative: "source.ts",
              display: "source.ts",
            },
          ],
        },
      ],
      units: [],
      addresses: [],
      hosts: [],
      declarations: [],
      reviews: [],
      diagnostics: [],
      dependencies: [],
    };
  }

  /**
   * Maps one exact fixture fragment to its source range.
   *
   * The helper rejects absent text so a changed fixture cannot silently attach
   * a graph record at an unrelated offset.
   */
  export function range(
    inventory: IEvidenceInventory,
    fragment: string,
  ): IEvidenceSourceRange {
    const source = inventory.sources[0];
    if (source === undefined) throw new Error("The fixture has no source.");
    const start = source.content.indexOf(fragment);
    if (start < 0)
      throw new Error("The fixture source does not contain: " + fragment);
    return new EvidenceSourceText(source.content).range(
      start,
      start + fragment.length,
    );
  }

  /**
   * Adds one explicit semantic unit and matching public address to a fixture.
   *
   * The named source fragment supplies both site and content ranges, letting
   * graph tests isolate ownership from adapter-specific extraction behavior.
   */
  export function unit(
    inventory: IEvidenceInventory,
    id: string,
    identity: string[],
    symbol: EvidenceSymbol,
    fragment: string,
    parentId?: string,
  ): IEvidenceUnit {
    const span = range(inventory, fragment);
    const unit: IEvidenceUnit = {
      id,
      type: "typescript",
      symbol,
      identity,
      name: identity.at(-1) ?? "",
      sites: [
        {
          id: id + "-site",
          file: "/project/source.ts",
          range: span,
          content: [span],
        },
      ],
      withdrawals: [],
      ...(parentId === undefined ? {} : { parentId }),
    };
    inventory.units.push(unit);
    inventory.addresses.push({
      unitId: id,
      file: "/project/source.ts",
      segments: identity,
    });
    return unit;
  }

  /**
   * Adds one documentation host attached to caller-selected unit IDs.
   *
   * Tests choose the site and source fragment explicitly so shared-host and
   * checklist behavior can be exercised without inferred attachment rules.
   */
  export function host(
    inventory: IEvidenceInventory,
    id: string,
    siteId: string,
    unitIds: string[],
    fragment: string,
  ): IEvidenceHost {
    const host: IEvidenceHost = {
      id,
      file: "/project/source.ts",
      range: range(inventory, fragment),
      siteId,
      unitIds,
      attachment: "attached",
    };
    inventory.hosts.push(host);
    return host;
  }
}
