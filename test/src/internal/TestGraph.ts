import type { IEvidenceDeclaration } from "../../../packages/evidence/src/structures/IEvidenceDeclaration";
import type { IEvidenceGraphResolution } from "../../../packages/evidence/src/structures/IEvidenceGraphResolution";
import type { IEvidenceGraphObligation } from "../../../packages/evidence/src/structures/IEvidenceGraphObligation";
import type { IEvidenceGraphResult } from "../../../packages/evidence/src/structures/IEvidenceGraphResult";
import type { IEvidenceHost } from "../../../packages/evidence/src/structures/IEvidenceHost";
import type { IEvidenceInventory } from "../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceTargetResolution } from "../../../packages/evidence/src/structures/IEvidenceTargetResolution";
import type { IEvidenceUnit } from "../../../packages/evidence/src/structures/IEvidenceUnit";
import type { EvidenceAcknowledgementKind } from "../../../packages/evidence/src/typings/EvidenceAcknowledgementKind";
import { SourceText } from "../../../packages/evidence/src/internal/SourceText";

/** Builds graph statements and already-resolved targets for pure policy tests. */
export namespace TestGraph {
  export function declaration(
    inventory: IEvidenceInventory,
    id: string,
    host: IEvidenceHost,
    kind: EvidenceAcknowledgementKind,
    target: string,
  ): IEvidenceDeclaration {
    const source = inventory.sources.find(
      (candidate) => candidate.physicalPath === host.file,
    );
    const offset = Math.min(
      host.range.start.offset + inventory.declarations.length,
      host.range.end.offset,
    );
    const declaration: IEvidenceDeclaration = {
      id,
      hostId: host.id,
      kind,
      target,
      reason: "The fixture host answers this target.",
      location: {
        file: host.file,
        range:
          source === undefined
            ? host.range
            : new SourceText(source.content).range(offset, offset),
      },
    };
    inventory.declarations.push(declaration);
    return declaration;
  }

  export function resolved(
    declaration: IEvidenceDeclaration,
    unit: IEvidenceUnit,
  ): IEvidenceGraphResolution {
    return {
      declarationId: declaration.id,
      resolution: resolution(unit),
    };
  }

  export function resolution(unit: IEvidenceUnit): IEvidenceTargetResolution {
    return {
      status: "resolved",
      addresses: [],
      units: [unit],
      withdrawals: [],
      diagnostics: [],
    };
  }

  export function obligation(
    result: IEvidenceGraphResult,
    claim: number,
    reference: number,
  ): IEvidenceGraphObligation {
    const claimResult = result.claims[claim];
    if (claimResult === undefined)
      throw new Error("Missing graph claim result.");
    const obligation = claimResult.obligations[reference];
    if (obligation === undefined) throw new Error("Missing graph obligation.");
    return obligation;
  }
}
