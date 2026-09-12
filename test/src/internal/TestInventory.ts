import { dedent } from "@typia/utils";
import { createHash } from "node:crypto";

import { SourceText } from "../../../packages/evidence/src/internal/SourceText";
import type { IEvidenceHost } from "../../../packages/evidence/src/structures/IEvidenceHost";
import type { IEvidenceInventory } from "../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceSourceRange } from "../../../packages/evidence/src/structures/IEvidenceSourceRange";
import type { IEvidenceUnit } from "../../../packages/evidence/src/structures/IEvidenceUnit";
import type { EvidenceSymbol } from "../../../packages/evidence/src/typings/EvidenceSymbol";

/** Explicit adapter records for testing identity and ownership independently of language extraction. */
export namespace TestInventory {
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
      complete: true,
      sources: [
        {
          id: "source",
          physicalPath: "/project/source.ts",
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

  export function range(
    inventory: IEvidenceInventory,
    fragment: string,
  ): IEvidenceSourceRange {
    const source = inventory.sources[0];
    if (source === undefined) throw new Error("The fixture has no source.");
    const start = source.content.indexOf(fragment);
    if (start < 0)
      throw new Error("The fixture source does not contain: " + fragment);
    return new SourceText(source.content).range(start, start + fragment.length);
  }

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
