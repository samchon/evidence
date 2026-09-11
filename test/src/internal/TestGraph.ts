import { EvidenceTargetResolver } from "../../../packages/evidence/src/EvidenceTargetResolver";
import type { IEvidenceDeclaration } from "../../../packages/evidence/src/structures/IEvidenceDeclaration";
import type { IEvidenceGraphResolution } from "../../../packages/evidence/src/structures/IEvidenceGraphResolution";
import type { IEvidenceGraphReviewResolution } from "../../../packages/evidence/src/structures/IEvidenceGraphReviewResolution";
import type { IEvidenceGraphHostCoverage } from "../../../packages/evidence/src/structures/IEvidenceGraphHostCoverage";
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

  export async function resolveDeclarations(
    claim: IEvidenceInventory,
    reference: IEvidenceInventory,
    unitIds: string[],
  ): Promise<IEvidenceGraphResolution[]> {
    const resolver = new EvidenceTargetResolver([reference]);
    return Promise.all(
      claim.declarations.map(async (declaration) => ({
        declarationId: declaration.id,
        resolution: await resolver.resolve(
          declaration,
          host(claim, declaration.hostId),
          unitIds,
        ),
      })),
    );
  }

  export async function resolveReviews(
    claim: IEvidenceInventory,
    reference: IEvidenceInventory,
    unitIds: string[],
  ): Promise<IEvidenceGraphReviewResolution[]> {
    const resolver = new EvidenceTargetResolver([reference]);
    return Promise.all(
      claim.reviews.map(async (review) => ({
        reviewId: review.id,
        resolution: await resolver.resolve(
          review,
          host(claim, review.hostId),
          unitIds,
        ),
      })),
    );
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

  export function hostCoverage(
    result: IEvidenceGraphResult,
    claim: number,
    reference: number,
    hostUnitId: string,
  ): IEvidenceGraphHostCoverage {
    const coverage = obligation(result, claim, reference).hostCoverage.find(
      (candidate) => candidate.hostUnitId === hostUnitId,
    );
    if (coverage === undefined)
      throw new Error(`Missing graph host coverage: ${hostUnitId}`);
    return coverage;
  }

  function host(inventory: IEvidenceInventory, id: string): IEvidenceHost {
    const found = inventory.hosts.find((candidate) => candidate.id === id);
    if (found === undefined) throw new Error(`Missing graph host: ${id}`);
    return found;
  }
}
