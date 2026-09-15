import { EvidTargetResolver } from "evid";
import type {
  EvidAcknowledgementKind,
  IEvidDeclaration,
  IEvidGraphHostCoverage,
  IEvidGraphObligation,
  IEvidGraphResolution,
  IEvidGraphResult,
  IEvidGraphReviewResolution,
  IEvidHost,
  IEvidInventory,
  IEvidTargetResolution,
  IEvidUnit,
} from "evid";
import { EvidSourceText } from "evid";

/** Builds graph statements and already-resolved targets for pure policy tests. */
export namespace EvidTestGraph {
  export function declaration(
    inventory: IEvidInventory,
    id: string,
    host: IEvidHost,
    kind: EvidAcknowledgementKind,
    target: string,
  ): IEvidDeclaration {
    const source = inventory.sources.find(
      (candidate) => candidate.physicalPath === host.file,
    );
    const offset = Math.min(
      host.range.start.offset + inventory.declarations.length,
      host.range.end.offset,
    );
    const declaration: IEvidDeclaration = {
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
            : new EvidSourceText(source.content).range(offset, offset),
      },
    };
    inventory.declarations.push(declaration);
    return declaration;
  }

  export function resolved(
    declaration: IEvidDeclaration,
    unit: IEvidUnit,
  ): IEvidGraphResolution {
    return {
      declarationId: declaration.id,
      resolution: resolution(unit),
    };
  }

  export function resolution(unit: IEvidUnit): IEvidTargetResolution {
    return {
      status: "resolved",
      addresses: [],
      units: [unit],
      withdrawals: [],
      diagnostics: [],
    };
  }

  export async function resolveDeclarations(
    claim: IEvidInventory,
    reference: IEvidInventory,
    unitIds: string[],
  ): Promise<IEvidGraphResolution[]> {
    const resolver = new EvidTargetResolver([reference]);
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
    claim: IEvidInventory,
    reference: IEvidInventory,
    unitIds: string[],
  ): Promise<IEvidGraphReviewResolution[]> {
    const resolver = new EvidTargetResolver([reference]);
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
    result: IEvidGraphResult,
    claim: number,
    reference: number,
  ): IEvidGraphObligation {
    const claimResult = result.claims[claim];
    if (claimResult === undefined)
      throw new Error("Missing graph claim result.");
    const obligation = claimResult.obligations[reference];
    if (obligation === undefined) throw new Error("Missing graph obligation.");
    return obligation;
  }

  export function hostCoverage(
    result: IEvidGraphResult,
    claim: number,
    reference: number,
    hostUnitId: string,
  ): IEvidGraphHostCoverage {
    const coverage = obligation(result, claim, reference).hostCoverage.find(
      (candidate) => candidate.hostUnitId === hostUnitId,
    );
    if (coverage === undefined)
      throw new Error(`Missing graph host coverage: ${hostUnitId}`);
    return coverage;
  }

  function host(inventory: IEvidInventory, id: string): IEvidHost {
    const found = inventory.hosts.find((candidate) => candidate.id === id);
    if (found === undefined) throw new Error(`Missing graph host: ${id}`);
    return found;
  }
}
