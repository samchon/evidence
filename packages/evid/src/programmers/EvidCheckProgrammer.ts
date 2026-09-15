import { EvidGraph } from "../graph/EvidGraph";
import { EvidSourceLoader } from "../loaders/EvidSourceLoader";
import { EvidSwaggerAdapter } from "../adapters/swagger/EvidSwaggerAdapter";
import { EvidTargetResolver } from "../targets/EvidTargetResolver";
import { EvidAdapterFactory } from "../internal/EvidAdapterFactory";
import { EvidTargetApplicability } from "../internal/EvidTargetApplicability";
import { EvidFileGlob } from "../internal/EvidFileGlob";
import type { IEvidMaterializedClaim } from "../internal/IEvidMaterializedClaim";
import type { IEvidMaterializedReference } from "../internal/IEvidMaterializedReference";
import type { IEvidCheckAnalysis } from "../structures/IEvidCheckAnalysis";
import type { IEvidCheckClaim } from "../structures/IEvidCheckClaim";
import type { IEvidCheckCounts } from "../structures/IEvidCheckCounts";
import type { IEvidCheckObligation } from "../structures/IEvidCheckObligation";
import type { IEvidCheckReport } from "../structures/IEvidCheckReport";
import type { IEvidClaim } from "../structures/IEvidClaim";
import type { IEvidConfigPlan } from "../structures/IEvidConfigPlan";
import type { IEvidConfigPlanClaim } from "../structures/IEvidConfigPlanClaim";
import type { IEvidDiagnostic } from "../structures/IEvidDiagnostic";
import type { IEvidGraphClaim } from "../structures/IEvidGraphClaim";
import type { IEvidGraphInput } from "../structures/IEvidGraphInput";
import type { IEvidGraphReference } from "../structures/IEvidGraphReference";
import type { IEvidGraphResolution } from "../structures/IEvidGraphResolution";
import type { IEvidGraphResult } from "../structures/IEvidGraphResult";
import type { IEvidGraphReviewResolution } from "../structures/IEvidGraphReviewResolution";
import type { IEvidHost } from "../structures/IEvidHost";
import type { IEvidInventory } from "../structures/IEvidInventory";
import type { IEvidReference } from "../structures/IEvidReference";
import type { EvidSymbol } from "../typings/EvidSymbol";

import type { IEvidCheckContext } from "../contexts/IEvidCheckContext";
import type { IEvidClaimContext } from "../contexts/IEvidClaimContext";

/**
 * Turns a validated check plan into inventories, graph input, and a command
 * report.
 *
 * This namespace is the orchestration boundary between configuration and graph
 * evaluation. It keeps every configured reference independent, so the same
 * population can appear in several obligations without sharing a resolution or
 * silently discharging coverage in another claim.
 *
 * @example
 *   const claims = await EvidCheckProgrammer.materialize(plan);
 *   const analysis = await EvidCheckProgrammer.evaluate({ plan, claims });
 */
export namespace EvidCheckProgrammer {
  /**
   * Materializes every active claim and the reference populations it owns.
   *
   * The returned array retains the configuration-plan order because evaluation
   * and reporting use positions as stable claim coordinates. Loading is allowed
   * to run concurrently, but each materialized reference remains attached to
   * exactly the claim entry that declared it.
   */
  export async function materialize(
    plan: IEvidConfigPlan,
  ): Promise<IEvidMaterializedClaim[]> {
    return Promise.all(
      plan.claims.map((claim) => materializeClaim(plan.configFile, claim)),
    );
  }

  /**
   * Prepares graph input and evaluates the checker result for one execution.
   *
   * Preparation resolves annotations against each independent reference
   * boundary before {@link EvidGraph.evaluate} applies coverage policy. The
   * returned analysis deliberately retains both graph input and graph output so
   * query commands can explain the result without rebuilding or reloading
   * inventories.
   */
  export async function evaluate(
    context: IEvidCheckContext,
  ): Promise<IEvidCheckAnalysis> {
    const graphInput: IEvidGraphInput = {
      claims: await Promise.all(context.claims.map(prepareClaim)),
    };
    const graph = EvidGraph.evaluate(graphInput);
    return { graphInput, graph, report: report(context.plan, graph) };
  }

  /**
   * Loads a claim inventory and every reference inventory declared beneath it.
   *
   * All paths are resolved from the single configuration file, even though the
   * loads run concurrently. This produces selected unit identifiers only; it
   * does not add visible structural ancestors, which are a query-layer
   * concern.
   */
  async function materializeClaim(
    configFile: string,
    plan: IEvidConfigPlanClaim,
  ): Promise<IEvidMaterializedClaim> {
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
          } satisfies IEvidMaterializedReference;
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

  /**
   * Loads one configured population through the adapter that owns its artifact
   * grammar.
   *
   * File-backed Swagger is exceptional because its adapter owns direct document
   * loading. Every other population first expands source globs relative to the
   * configuration file, then transfers the resulting source snapshot to the
   * selected adapter for analysis.
   */
  async function load(
    configFile: string,
    population: IEvidClaim | IEvidReference,
  ): Promise<IEvidInventory> {
    if (population.type === "swagger" && "file" in population)
      return new EvidSwaggerAdapter().load(
        configFile,
        population.file,
        population.root,
      );
    const adapter = EvidAdapterFactory.create(population.type);
    return adapter.analyze(
      await EvidSourceLoader.glob(configFile, {
        ...(population.root === undefined ? {} : { root: population.root }),
        files: population.files,
      }),
    );
  }

  /**
   * Selects configured semantic identities from an inventory.
   *
   * The configuration's symbol kinds are the only selection criterion. Keeping
   * this result free of parent identities prevents graph coverage from treating
   * a structural ancestor as an independently configured obligation.
   */
  function selectUnitIds(
    inventory: IEvidInventory,
    symbols: EvidSymbol[],
  ): string[] {
    const selected = new Set(symbols);
    return inventory.units
      .filter((unit) => selected.has(unit.symbol))
      .map((unit) => unit.id);
  }

  /**
   * Selects documentation hosts whose source files match exclusion-carrier
   * globs.
   *
   * Matching starts from selected logical addresses, then maps their physical
   * files back to hosts. This lets aliases share one exclusion decision while
   * avoiding exclusions from an unselected logical source address.
   */
  function selectExclusionHosts(
    inventory: IEvidInventory,
    patterns: string[],
  ): string[] {
    const globs = new EvidFileGlob(patterns);
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

  /**
   * Clones a claim inventory and prepares its graph-facing reference
   * boundaries.
   *
   * The clone receives preparation diagnostics so the materialized inventory
   * can still serve as the unmodified loading result. Declaration and review
   * indexes record eligible reference positions before resolving targets,
   * ensuring an annotation is only evaluated where its grammar and host can
   * participate.
   */
  async function prepareClaim(
    materialized: IEvidMaterializedClaim,
  ): Promise<IEvidGraphClaim> {
    const inventory = structuredClone(materialized.inventory);
    const context: IEvidClaimContext = {
      materialized,
      inventory,
      hosts: new Map(inventory.hosts.map((host) => [host.id, host])),
      declarations: new Map<string, Set<number>>(),
      reviews: new Map<string, Set<number>>(),
    };
    const { hosts, declarations, reviews } = context;

    // Record applicability before resolution so an incompatible target becomes
    // one useful diagnostic instead of one resolution failure per reference.
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

  /**
   * Maps one annotation to the reference positions whose target grammar accepts
   * it.
   *
   * Positions, rather than reference identities, preserve duplicate configured
   * references as separate obligations. The returned set is later consulted by
   * both acknowledgement and review preparation.
   */
  function applicable(
    statement: Parameters<typeof EvidTargetApplicability.select>[0],
    host: IEvidHost,
    references: IEvidMaterializedReference[],
  ): Set<number> {
    return new Set(
      EvidTargetApplicability.select(statement, host, references).map(
        (selected) => references.indexOf(selected),
      ),
    );
  }

  /**
   * Builds one graph reference from the claim annotations eligible for this
   * position.
   *
   * A resolver sees only this reference inventory and its selected unit IDs.
   * That isolation is essential: the same textual target may resolve
   * differently in another reference population, and a review remains
   * independent of an acknowledgement that happens to cover the same identity.
   */
  async function prepareReference(
    context: IEvidClaimContext,
    materialized: IEvidMaterializedReference,
    position: number,
  ): Promise<IEvidGraphReference> {
    const { inventory: claim, hosts, declarations, reviews } = context;
    const resolver = new EvidTargetResolver(
      [materialized.inventory],
      materialized.plan.population.type,
    );
    const resolutions: IEvidGraphResolution[] = await Promise.all(
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
    const reviewResolutions: IEvidGraphReviewResolution[] = await Promise.all(
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
      ...(population.noEvidExclude === undefined
        ? {}
        : { noEvidExclude: population.noEvidExclude }),
      ...(population.uniqueEvid === undefined
        ? {}
        : { uniqueEvid: population.uniqueEvid }),
      ...(population.singleEvidPerSymbol === undefined
        ? {}
        : { singleEvidPerSymbol: population.singleEvidPerSymbol }),
      ...(population.requireReview === undefined
        ? {}
        : { requireReview: population.requireReview }),
      ...(population.type === "markdown" && population.checklist !== undefined
        ? { checklist: population.checklist }
        : {}),
    };
  }

  /**
   * Resolves one acknowledgement against a preselected reference population.
   *
   * The wrapper keeps the source declaration identity beside the resolver
   * output, allowing graph evaluation and inspection reports to trace every
   * edge back to the authored annotation.
   */
  async function resolveDeclaration(
    resolver: EvidTargetResolver,
    declaration: IEvidInventory["declarations"][number],
    host: IEvidHost,
    unitIds: string[],
  ): Promise<IEvidGraphResolution> {
    return {
      declarationId: declaration.id,
      resolution: await resolver.resolve(declaration, host, unitIds),
    };
  }

  /**
   * Resolves one review against the same boundary used for acknowledgements.
   *
   * Reviews are returned in a separate collection because review policy
   * assesses their status independently; resolving one must never manufacture
   * an evidence edge or change coverage counts.
   */
  async function resolveReview(
    resolver: EvidTargetResolver,
    review: IEvidInventory["reviews"][number],
    host: IEvidHost,
    unitIds: string[],
  ): Promise<IEvidGraphReviewResolution> {
    return {
      reviewId: review.id,
      resolution: await resolver.resolve(review, host, unitIds),
    };
  }

  /**
   * Retrieves an annotation host from the claim-local host index.
   *
   * A missing host means an inventory invariant was broken after parsing.
   * Throwing here prevents a later resolver error from losing the statement
   * identity that caused the invalid graph input.
   */
  function requireHost(hosts: Map<string, IEvidHost>, id: string): IEvidHost {
    const host = hosts.get(id);
    if (host === undefined)
      throw new Error(`Evid statement '${id}' has no documentation host.`);
    return host;
  }

  /**
   * Tests whether an indexed annotation participates in one reference position.
   *
   * Missing records are treated as nonparticipating. This keeps the caller safe
   * when an inventory has no annotation of the requested identity while
   * retaining position-based separation for duplicated reference entries.
   */
  function selected(
    records: Map<string, Set<number>>,
    id: string,
    position: number,
  ): boolean {
    const positions = records.get(id);
    return positions !== undefined && positions.has(position);
  }

  /**
   * Appends diagnostics for annotations accepted by no configured reference.
   *
   * Both acknowledgement and review diagnostics retain the authored location,
   * host, and target so a caller can repair configuration or source text
   * without inferring which pre-resolution applicability decision failed.
   */
  function reportNonParticipating(
    inventory: IEvidInventory,
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

  /**
   * Converts evaluated graph state into the stable public check report.
   *
   * Completion is stricter than diagnostic success: inactive claims are
   * ignored, while every active claim and active obligation must be complete.
   * Exit code 2 denotes incomplete graph state, code 1 denotes a complete graph
   * with errors, and code 0 denotes a successful execution.
   */
  function report(
    plan: IEvidConfigPlan,
    graph: IEvidGraphResult,
  ): IEvidCheckReport {
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

  /**
   * Projects graph claims into report rows using their configuration-plan
   * labels.
   *
   * Positional joins are intentional: graph input is constructed in plan order,
   * including duplicate populations. Missing plan entries are invariant
   * failures, not report omissions, because emitting a relabelled obligation
   * would mislead consumers about the policy that produced it.
   */
  function checkClaims(
    plan: IEvidConfigPlan,
    graph: IEvidGraphResult,
  ): IEvidCheckClaim[] {
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
          } satisfies IEvidCheckObligation;
        }),
      } satisfies IEvidCheckClaim;
    });
  }

  /**
   * Summarizes claims, active obligations, coverage, and diagnostic severities.
   *
   * Coverage totals include only active obligations, matching the policy used
   * for completion. Overall claim and obligation counts remain unfiltered so
   * callers can distinguish disabled configuration from absent configuration.
   */
  function checkCounts(
    claims: IEvidCheckClaim[],
    diagnostics: IEvidDiagnostic[],
  ): IEvidCheckCounts {
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

  /**
   * Compares diagnostics using the report's deterministic ordering contract.
   *
   * Claim and reference coordinates come first, followed by source location and
   * diagnostic identity. The final message comparison makes otherwise identical
   * diagnostics stable across adapter iteration order and operating systems.
   */
  function compareDiagnostics(
    left: IEvidDiagnostic,
    right: IEvidDiagnostic,
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

  /**
   * Compares two report strings using code-unit order.
   *
   * This deliberately avoids locale-sensitive collation so serialized checker
   * output has the same order on every platform.
   */
  function compare(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
  }

  /**
   * Compares numeric report coordinates in ascending order.
   *
   * Callers pass only bounded graph indexes and source offsets, so subtraction
   * supplies a compact comparator while preserving exact coordinate priority.
   */
  function compareNumber(left: number, right: number): number {
    return left - right;
  }

  /**
   * Returns the first decisive comparison result in priority order.
   *
   * Comparator construction remains separate from execution so ordering rules
   * can be read as a single ordered list in {@link compareDiagnostics}.
   */
  function firstDifference(values: number[]): number {
    return values.find((value) => value !== 0) ?? 0;
  }
}
