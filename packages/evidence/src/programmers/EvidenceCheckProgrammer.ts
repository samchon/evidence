import { EvidenceGraph } from "../graph/EvidenceGraph";
import { EvidenceSourceLoader } from "../loaders/EvidenceSourceLoader";
import { EvidenceSwaggerAdapter } from "../adapters/swagger/EvidenceSwaggerAdapter";
import { EvidenceTargetResolver } from "../targets/EvidenceTargetResolver";
import { EvidenceAdapterFactory } from "../internal/EvidenceAdapterFactory";
import { EvidenceTargetApplicability } from "../internal/EvidenceTargetApplicability";
import { FileGlob } from "../internal/FileGlob";
import type { IEvidenceMaterializedClaim } from "../internal/IEvidenceMaterializedClaim";
import type { IEvidenceMaterializedReference } from "../internal/IEvidenceMaterializedReference";
import type { IEvidenceCheckAnalysis } from "../structures/IEvidenceCheckAnalysis";
import type { IEvidenceCheckClaim } from "../structures/IEvidenceCheckClaim";
import type { IEvidenceCheckCounts } from "../structures/IEvidenceCheckCounts";
import type { IEvidenceCheckObligation } from "../structures/IEvidenceCheckObligation";
import type { IEvidenceCheckReport } from "../structures/IEvidenceCheckReport";
import type { IEvidenceClaim } from "../structures/IEvidenceClaim";
import type { IEvidenceConfigPlan } from "../structures/IEvidenceConfigPlan";
import type { IEvidenceConfigPlanClaim } from "../structures/IEvidenceConfigPlanClaim";
import type { IEvidenceDiagnostic } from "../structures/IEvidenceDiagnostic";
import type { IEvidenceGraphClaim } from "../structures/IEvidenceGraphClaim";
import type { IEvidenceGraphInput } from "../structures/IEvidenceGraphInput";
import type { IEvidenceGraphReference } from "../structures/IEvidenceGraphReference";
import type { IEvidenceGraphResolution } from "../structures/IEvidenceGraphResolution";
import type { IEvidenceGraphResult } from "../structures/IEvidenceGraphResult";
import type { IEvidenceGraphReviewResolution } from "../structures/IEvidenceGraphReviewResolution";
import type { IEvidenceHost } from "../structures/IEvidenceHost";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidenceReference } from "../structures/IEvidenceReference";
import type { EvidenceSymbol } from "../typings/EvidenceSymbol";

import type { IEvidenceCheckContext } from "../contexts/IEvidenceCheckContext";
import type { IEvidenceClaimContext } from "../contexts/IEvidenceClaimContext";

/** Materializes, resolves, and reports the inputs owned by a checker execution. */
export namespace EvidenceCheckProgrammer {
  /** Loads each configured population before claim participation is resolved. */
  export async function materialize(
    plan: IEvidenceConfigPlan,
  ): Promise<IEvidenceMaterializedClaim[]> {
    return Promise.all(
      plan.claims.map((claim) => materializeClaim(plan.configFile, claim)),
    );
  }

  /** Builds the graph and command report from one materialized execution context. */
  export async function evaluate(
    context: IEvidenceCheckContext,
  ): Promise<IEvidenceCheckAnalysis> {
    const graphInput: IEvidenceGraphInput = {
      claims: await Promise.all(context.claims.map(prepareClaim)),
    };
    const graph = EvidenceGraph.evaluate(graphInput);
    return { graphInput, graph, report: report(context.plan, graph) };
  }

  /** Loads one claim and its independent reference populations from the same configuration base. */
  async function materializeClaim(
    configFile: string,
    plan: IEvidenceConfigPlanClaim,
  ): Promise<IEvidenceMaterializedClaim> {
    const [inventory, references] = await Promise.all([
      load(configFile, plan.population),
      Promise.all(
        plan.references.map(async (reference) => {
          const referenceInventory = await load(
            configFile,
            reference.population,
          );
          return {
            plan: reference,
            inventory: referenceInventory,
            unitIds: selectUnitIds(referenceInventory, reference.symbols),
          } satisfies IEvidenceMaterializedReference;
        }),
      ),
    ]);
    return {
      plan,
      inventory,
      unitIds: selectUnitIds(inventory, plan.symbols),
      ...(plan.population.evidenceExcludeCarriers === undefined
        ? {}
        : {
            exclusionHostIds: selectExclusionHosts(
              inventory,
              plan.population.evidenceExcludeCarriers,
            ),
          }),
      references,
    };
  }

  /** Selects the artifact adapter and loads the local or remote population it accepts. */
  async function load(
    configFile: string,
    population: IEvidenceClaim | IEvidenceReference,
  ): Promise<IEvidenceInventory> {
    if (population.type === "swagger" && "file" in population)
      return new EvidenceSwaggerAdapter().load(
        configFile,
        population.file,
        population.root,
      );
    const adapter = EvidenceAdapterFactory.create(population.type);
    return adapter.analyze(
      await EvidenceSourceLoader.glob(configFile, {
        ...(population.root === undefined ? {} : { root: population.root }),
        files: population.files,
      }),
    );
  }

  /** Selects semantic identities by configured symbol kinds without adding structural ancestors. */
  function selectUnitIds(
    inventory: IEvidenceInventory,
    symbols: EvidenceSymbol[],
  ): string[] {
    const selected = new Set(symbols);
    return inventory.units
      .filter((unit) => selected.has(unit.symbol))
      .map((unit) => unit.id);
  }

  /** Selects exclusion carriers whose source addresses match the configured file globs. */
  function selectExclusionHosts(
    inventory: IEvidenceInventory,
    patterns: string[],
  ): string[] {
    const globs = new FileGlob(patterns);
    const files = new Set(
      inventory.sources.flatMap((source) =>
        source.addresses.some(
          (address) =>
            address.selected !== false && globs.matches(address.relative),
        )
          ? [source.physicalPath]
          : [],
      ),
    );
    return inventory.hosts
      .filter((host) => files.has(host.file))
      .map((host) => host.id);
  }

  /** Builds claim participation indexes before resolving each reference obligation. */
  async function prepareClaim(
    materialized: IEvidenceMaterializedClaim,
  ): Promise<IEvidenceGraphClaim> {
    const inventory = structuredClone(materialized.inventory);
    const context: IEvidenceClaimContext = {
      materialized,
      inventory,
      hosts: new Map(inventory.hosts.map((host) => [host.id, host])),
      declarations: new Map<string, Set<number>>(),
      reviews: new Map<string, Set<number>>(),
    };
    const { hosts, declarations, reviews } = context;

    for (const declaration of inventory.declarations)
      declarations.set(
        declaration.id,
        applicable(
          declaration,
          requireHost(hosts, declaration.hostId),
          materialized.references,
        ),
      );
    for (const review of inventory.reviews)
      reviews.set(
        review.id,
        applicable(
          review,
          requireHost(hosts, review.hostId),
          materialized.references,
        ),
      );
    reportNonParticipating(inventory, declarations, reviews);

    return {
      index: materialized.plan.index,
      ...(materialized.plan.population.name === undefined
        ? {}
        : { name: materialized.plan.population.name }),
      severity: materialized.plan.severity,
      inventory,
      unitIds: materialized.unitIds,
      ...(materialized.exclusionHostIds === undefined
        ? {}
        : { exclusionHostIds: materialized.exclusionHostIds }),
      references: await Promise.all(
        materialized.references.map((reference, position) =>
          prepareReference(context, reference, position),
        ),
      ),
    };
  }

  /** Maps an annotation to the positions of reference populations that accept its target grammar. */
  function applicable(
    statement: Parameters<typeof EvidenceTargetApplicability.select>[0],
    host: IEvidenceHost,
    references: IEvidenceMaterializedReference[],
  ): Set<number> {
    return new Set(
      EvidenceTargetApplicability.select(statement, host, references).map(
        (selected) => references.indexOf(selected),
      ),
    );
  }

  /** Resolves acknowledgements and reviews using the shared claim context and this reference selection. */
  async function prepareReference(
    context: IEvidenceClaimContext,
    materialized: IEvidenceMaterializedReference,
    position: number,
  ): Promise<IEvidenceGraphReference> {
    const { inventory: claim, hosts, declarations, reviews } = context;
    const resolver = new EvidenceTargetResolver(
      [materialized.inventory],
      materialized.plan.population.type,
    );
    const resolutions: IEvidenceGraphResolution[] = await Promise.all(
      claim.declarations.flatMap((declaration) =>
        selected(declarations, declaration.id, position)
          ? [
              resolveDeclaration(
                resolver,
                declaration,
                requireHost(hosts, declaration.hostId),
                materialized.unitIds,
              ),
            ]
          : [],
      ),
    );
    const reviewResolutions: IEvidenceGraphReviewResolution[] =
      await Promise.all(
        claim.reviews.flatMap((review) =>
          selected(reviews, review.id, position)
            ? [
                resolveReview(
                  resolver,
                  review,
                  requireHost(hosts, review.hostId),
                  materialized.unitIds,
                ),
              ]
            : [],
        ),
      );
    const population = materialized.plan.population;
    return {
      index: materialized.plan.index,
      severity: materialized.plan.severity,
      inventory: materialized.inventory,
      unitIds: materialized.unitIds,
      resolutions,
      reviewResolutions,
      ...(population.noEvidenceExclude === undefined
        ? {}
        : { noEvidenceExclude: population.noEvidenceExclude }),
      ...(population.uniqueEvidence === undefined
        ? {}
        : { uniqueEvidence: population.uniqueEvidence }),
      ...(population.singleEvidencePerSymbol === undefined
        ? {}
        : { singleEvidencePerSymbol: population.singleEvidencePerSymbol }),
      ...(population.requireReview === undefined
        ? {}
        : { requireReview: population.requireReview }),
      ...(population.type === "markdown" && population.checklist !== undefined
        ? { checklist: population.checklist }
        : {}),
    };
  }

  /** Resolves an acknowledgement within the reference selection established for its host. */
  async function resolveDeclaration(
    resolver: EvidenceTargetResolver,
    declaration: IEvidenceInventory["declarations"][number],
    host: IEvidenceHost,
    unitIds: string[],
  ): Promise<IEvidenceGraphResolution> {
    return {
      declarationId: declaration.id,
      resolution: await resolver.resolve(declaration, host, unitIds),
    };
  }

  /** Resolves a review independently of the acknowledgements that may discharge coverage. */
  async function resolveReview(
    resolver: EvidenceTargetResolver,
    review: IEvidenceInventory["reviews"][number],
    host: IEvidenceHost,
    unitIds: string[],
  ): Promise<IEvidenceGraphReviewResolution> {
    return {
      reviewId: review.id,
      resolution: await resolver.resolve(review, host, unitIds),
    };
  }

  /** Requires an annotation host to exist in the indexed claim inventory. */
  function requireHost(
    hosts: Map<string, IEvidenceHost>,
    id: string,
  ): IEvidenceHost {
    const host = hosts.get(id);
    if (host === undefined)
      throw new Error(`Evidence statement '${id}' has no documentation host.`);
    return host;
  }

  /** Tests whether an annotation participates in the specified reference position. */
  function selected(
    records: Map<string, Set<number>>,
    id: string,
    position: number,
  ): boolean {
    const positions = records.get(id);
    return positions !== undefined && positions.has(position);
  }

  /** Reports annotations that match none of the configured reference populations. */
  function reportNonParticipating(
    inventory: IEvidenceInventory,
    declarations: Map<string, Set<number>>,
    reviews: Map<string, Set<number>>,
  ): void {
    for (const declaration of inventory.declarations)
      if (declarations.get(declaration.id)?.size === 0)
        inventory.diagnostics.push({
          code: "check-non-participating-acknowledgement",
          severity: "error",
          message: `@${declaration.kind} target '${declaration.target}' belongs to no active reference in this claim.`,
          repair:
            "Correct the target or add the reference population that this claim must acknowledge.",
          location: declaration.location,
          hostId: declaration.hostId,
          target: declaration.target,
        });
    for (const review of inventory.reviews)
      if (reviews.get(review.id)?.size === 0)
        inventory.diagnostics.push({
          code: "check-non-participating-review",
          severity: "error",
          message: `Review target '${review.target}' belongs to no active reference in this claim.`,
          repair:
            "Correct the review target or remove the review when no acknowledgement uses it.",
          location: review.location,
          hostId: review.hostId,
          target: review.target,
        });
  }

  /** Converts graph results into the deterministic checker status, counts, and diagnostics. */
  function report(
    plan: IEvidenceConfigPlan,
    graph: IEvidenceGraphResult,
  ): IEvidenceCheckReport {
    const claims = checkClaims(plan, graph);
    const diagnostics = [...graph.diagnostics].sort(compareDiagnostics);
    const complete = graph.claims.every(
      (claim) =>
        !claim.active ||
        (claim.complete &&
          claim.obligations.every(
            (obligation) => !obligation.active || obligation.complete,
          )),
    );
    const counts = checkCounts(claims, diagnostics);
    const success = complete && counts.errors === 0;
    return {
      schemaVersion: 1,
      command: "check",
      configFile: plan.configFile,
      status: complete ? "complete" : "incomplete",
      success,
      exitCode: !complete ? 2 : success ? 0 : 1,
      counts,
      claims,
      diagnostics,
    };
  }

  /** Combines configured claim labels and policies with evaluated obligation results. */
  function checkClaims(
    plan: IEvidenceConfigPlan,
    graph: IEvidenceGraphResult,
  ): IEvidenceCheckClaim[] {
    return graph.claims.map((result, position) => {
      const claim = plan.claims[position];
      if (claim === undefined)
        throw new Error(`Graph claim ${position} has no configuration plan.`);
      return {
        claim: claim.index,
        ...(claim.population.name === undefined
          ? {}
          : { name: claim.population.name }),
        type: claim.population.type,
        active: result.active,
        complete: result.complete,
        obligations: result.obligations.map((obligation, referencePosition) => {
          const reference = claim.references[referencePosition];
          if (reference === undefined)
            throw new Error(
              `Graph obligation ${position}:${referencePosition} has no configuration plan.`,
            );
          return {
            claim: claim.index,
            reference: reference.index,
            type: reference.population.type,
            severity: reference.severity,
            active: obligation.active,
            complete: obligation.complete,
            units: obligation.unitIds.length,
            coveredUnits: obligation.coveredUnitIds.length,
            missingUnits: obligation.missingUnitIds.length,
          } satisfies IEvidenceCheckObligation;
        }),
      } satisfies IEvidenceCheckClaim;
    });
  }

  /** Counts active obligations, coverage, and diagnostic severities for the command report. */
  function checkCounts(
    claims: IEvidenceCheckClaim[],
    diagnostics: IEvidenceDiagnostic[],
  ): IEvidenceCheckCounts {
    const obligations = claims.flatMap((claim) => claim.obligations);
    const active = obligations.filter((obligation) => obligation.active);
    return {
      claims: claims.length,
      activeClaims: claims.filter((claim) => claim.active).length,
      obligations: obligations.length,
      activeObligations: obligations.filter((obligation) => obligation.active)
        .length,
      incompleteObligations: obligations.filter(
        (obligation) => obligation.active && !obligation.complete,
      ).length,
      units: active.reduce((sum, obligation) => sum + obligation.units, 0),
      coveredUnits: active.reduce(
        (sum, obligation) => sum + obligation.coveredUnits,
        0,
      ),
      missingUnits: active.reduce(
        (sum, obligation) => sum + obligation.missingUnits,
        0,
      ),
      errors: diagnostics.filter(
        (diagnostic) => diagnostic.severity === "error",
      ).length,
      warnings: diagnostics.filter(
        (diagnostic) => diagnostic.severity === "warning",
      ).length,
    };
  }

  /** Orders diagnostics by stable source, graph, and message coordinates. */
  function compareDiagnostics(
    left: IEvidenceDiagnostic,
    right: IEvidenceDiagnostic,
  ): number {
    const leftRange = left.location?.range;
    const rightRange = right.location?.range;
    return firstDifference([
      compareNumber(left.claim ?? -1, right.claim ?? -1),
      compareNumber(left.reference ?? -1, right.reference ?? -1),
      compare(left.location?.file ?? "", right.location?.file ?? ""),
      compareNumber(
        leftRange === undefined ? -1 : leftRange.start.offset,
        rightRange === undefined ? -1 : rightRange.start.offset,
      ),
      compare(left.code, right.code),
      compare(left.hostId ?? "", right.hostId ?? ""),
      compare(left.target ?? "", right.target ?? ""),
      compare(left.message, right.message),
    ]);
  }

  /** Compares text using the report ordering shared across platforms. */
  function compare(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
  }

  /** Compares numeric report coordinates in ascending order. */
  function compareNumber(left: number, right: number): number {
    return left - right;
  }

  /** Returns the first nonzero comparison in the requested ordering priority. */
  function firstDifference(values: number[]): number {
    return values.find((value) => value !== 0) ?? 0;
  }
}
