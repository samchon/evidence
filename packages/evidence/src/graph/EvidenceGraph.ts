import type { IEvidenceGraphClaimContext } from "../contexts/IEvidenceGraphClaimContext";
import type { IEvidenceGraphReferenceContext } from "../contexts/IEvidenceGraphReferenceContext";
import typia from "typia";

import { EvidenceFileTarget } from "../targets/EvidenceFileTarget";
import { EvidenceInventory } from "./EvidenceInventory";
import { EvidenceFingerprintIndex } from "../internal/EvidenceFingerprintIndex";
import type { IEvidenceResolvedAcknowledgement } from "../internal/IEvidenceResolvedAcknowledgement";
import { InventoryMerge } from "../internal/InventoryMerge";
import type { IEvidenceResolvedReview } from "../internal/IEvidenceResolvedReview";
import type { IEvidenceUnhostedChecklist } from "../internal/IEvidenceUnhostedChecklist";
import type { IEvidenceDeclaration } from "../structures/IEvidenceDeclaration";
import type { IEvidenceDiagnostic } from "../structures/IEvidenceDiagnostic";
import type { IEvidenceGraphClaim } from "../structures/IEvidenceGraphClaim";
import type { IEvidenceGraphClaimResult } from "../structures/IEvidenceGraphClaimResult";
import type { IEvidenceGraphEdge } from "../structures/IEvidenceGraphEdge";
import type { IEvidenceGraphHostCoverage } from "../structures/IEvidenceGraphHostCoverage";
import type { IEvidenceGraphInput } from "../structures/IEvidenceGraphInput";
import type { IEvidenceGraphObligation } from "../structures/IEvidenceGraphObligation";
import type { IEvidenceGraphReference } from "../structures/IEvidenceGraphReference";
import type { IEvidenceGraphReviewResolution } from "../structures/IEvidenceGraphReviewResolution";
import type { IEvidenceGraphResolution } from "../structures/IEvidenceGraphResolution";
import type { IEvidenceGraphResult } from "../structures/IEvidenceGraphResult";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidencePopulation } from "../structures/IEvidencePopulation";
import type { IEvidenceTargetStatement } from "../structures/IEvidenceTargetStatement";
import type { IEvidenceUnit } from "../structures/IEvidenceUnit";
import type { EvidenceAcknowledgementKind } from "../typings/EvidenceAcknowledgementKind";
import type { EvidenceSeverity } from "../typings/EvidenceSeverity";

/**
 * Coordinates graph evaluation over one captured input.
 *
 * Each evaluation uses a fresh evaluator so diagnostics and coverage state never carry over between calls.
 */
export class EvidenceGraph {
  /** Validated input snapshot owned by this graph facade. */
  private readonly input: IEvidenceGraphInput;

  /** Validates and captures the graph input before evaluation. */
  public constructor(input: IEvidenceGraphInput) {
    this.input = structuredClone(typia.assert(input));
  }

  /** Evaluates the captured input and returns an independently owned result. */
  public evaluate(): IEvidenceGraphResult {
    return structuredClone(new GraphEvaluator(this.input).evaluate());
  }

  /** Creates a graph facade for one evaluation. */
  public static evaluate(input: IEvidenceGraphInput): IEvidenceGraphResult {
    return new EvidenceGraph(input).evaluate();
  }
}

/** Tracks coverage and diagnostics for exactly one graph evaluation. */
class GraphEvaluator {
  /** Acknowledgements handled by at least one complete applicable obligation. */
  private readonly answeredDeclarations = new Set<string>();

  /** Diagnostics accumulated only for this evaluator invocation. */
  private readonly diagnostics: IEvidenceDiagnostic[] = [];

  /** Acknowledgements whose participation cannot be decided from incomplete analysis. */
  private readonly uncertainDeclarations = new Set<string>();

  /** Checklist acknowledgements awaiting a final decision across applicable references. */
  private readonly unhostedChecklists = new Map<
    string,
    IEvidenceUnhostedChecklist
  >();

  /** Validated graph input shared with this invocation's claim contexts. */
  private readonly input: IEvidenceGraphInput;

  /** Binds the already validated input snapshot to a fresh evaluation state. */
  public constructor(input: IEvidenceGraphInput) {
    this.input = input;
  }

  /** Evaluates all claims and finalizes diagnostics after cross-reference participation is known. */
  public evaluate(): IEvidenceGraphResult {
    const claims = this.input.claims.map((claim, index) =>
      this.evaluateClaim(claim, index),
    );
    this.reportUnhostedChecklists();
    const diagnostics = InventoryMerge.unique(this.diagnostics, (diagnostic) =>
      typia.json.stringify(diagnostic),
    );
    const complete = claims.every(
      (claim) =>
        !claim.active ||
        (claim.complete &&
          claim.obligations.every(
            (obligation) => !obligation.active || obligation.complete,
          )),
    );
    return {
      success: complete && diagnostics.length === 0,
      claims,
      diagnostics,
    };
  }

  /** Creates a claim context and evaluates each active reference independently. */
  private evaluateClaim(
    claim: IEvidenceGraphClaim,
    claimIndex: number,
  ): IEvidenceGraphClaimResult {
    if (claim.severity === "off")
      return {
        claim: this.claimIndex(claimIndex),
        active: false,
        complete: true,
        obligations: claim.references.map((reference, referenceIndex) =>
          this.inactiveObligation(claimIndex, referenceIndex, reference),
        ),
      };
    const inventory = new EvidenceInventory([claim.inventory]);
    const snapshot = inventory.snapshot();
    const population = inventory.select(claim.unitIds);
    const context: IEvidenceGraphClaimContext = {
      claim,
      inventory: snapshot,
      population,
      index: claimIndex,
    };
    this.diagnostics.push(
      ...snapshot.diagnostics.map((diagnostic) =>
        this.context(diagnostic, claim.severity, claimIndex),
      ),
    );
    if (!snapshot.complete)
      for (const declaration of snapshot.declarations)
        this.uncertainDeclarations.add(declaration.id);
    if (snapshot.complete && population.units.length === 0)
      return {
        claim: this.claimIndex(claimIndex),
        active: false,
        complete: true,
        obligations: claim.references.map((reference, referenceIndex) =>
          this.inactiveObligation(claimIndex, referenceIndex, reference),
        ),
      };
    const obligations = claim.references.map((reference, referenceIndex) =>
      snapshot.complete
        ? this.evaluateReference(context, reference, referenceIndex)
        : this.incompleteObligation(claimIndex, referenceIndex, reference),
    );
    return {
      claim: this.claimIndex(claimIndex),
      active: true,
      complete: snapshot.complete,
      obligations,
    };
  }

  /** Validates the reference population and resolves whether coverage can be evaluated completely. */
  private evaluateReference(
    context: IEvidenceGraphClaimContext,
    reference: IEvidenceGraphReference,
    referenceIndex: number,
  ): IEvidenceGraphObligation {
    const { claim, inventory: claimInventory, index: claimIndex } = context;
    if (reference.severity === "off")
      return this.inactiveObligation(claimIndex, referenceIndex, reference);
    const inventory = new EvidenceInventory([reference.inventory]);
    const snapshot = inventory.snapshot();
    const population = inventory.select(reference.unitIds);
    this.validateReferencePolicy(
      claim,
      reference,
      population,
      claimIndex,
      referenceIndex,
    );
    this.diagnostics.push(
      ...snapshot.diagnostics.map((diagnostic) =>
        this.context(
          diagnostic,
          reference.severity,
          claimIndex,
          referenceIndex,
        ),
      ),
    );
    if (!snapshot.complete)
      for (const declaration of claimInventory.declarations)
        this.uncertainDeclarations.add(declaration.id);
    const unitIds = population.units.map((unit) => unit.id);
    if (!snapshot.complete)
      return this.obligation(
        claimIndex,
        referenceIndex,
        true,
        false,
        unitIds,
        [],
        [],
      );
    if (unitIds.length === 0) {
      this.diagnostics.push(
        this.problem(
          "graph-empty-reference",
          reference.severity,
          "The reference contains no selected evidence units.",
          "Select symbol kinds present in the reference files or correct its source selection.",
          claimIndex,
          referenceIndex,
        ),
      );
      return this.obligation(
        claimIndex,
        referenceIndex,
        true,
        true,
        [],
        [],
        [],
      );
    }
    const resolutions = this.resolutions(
      claimInventory,
      reference,
      claimIndex,
      referenceIndex,
    );
    const reviewResolutions = this.reviewResolutions(
      claimInventory,
      reference,
      claimIndex,
      referenceIndex,
    );
    for (const entry of resolutions)
      this.diagnostics.push(
        ...entry.resolution.diagnostics.map((diagnostic) =>
          this.context(
            diagnostic,
            reference.severity,
            claimIndex,
            referenceIndex,
          ),
        ),
      );
    for (const entry of reviewResolutions)
      this.diagnostics.push(
        ...entry.resolution.diagnostics.map((diagnostic) =>
          this.context(
            diagnostic,
            reference.severity,
            claimIndex,
            referenceIndex,
          ),
        ),
      );
    const incomplete = [
      ...resolutions.map((entry) => entry.resolution.status),
      ...reviewResolutions.map((entry) => entry.resolution.status),
    ].includes("incomplete");
    if (incomplete) {
      for (const entry of resolutions)
        if (entry.resolution.status === "incomplete")
          this.uncertainDeclarations.add(entry.declarationId);
      if (
        reviewResolutions.some(
          (entry) => entry.resolution.status === "incomplete",
        )
      )
        for (const declaration of claimInventory.declarations)
          this.uncertainDeclarations.add(declaration.id);
      return this.obligation(
        claimIndex,
        referenceIndex,
        true,
        false,
        unitIds,
        [],
        [],
      );
    }
    return this.cover({
      claim: context,
      reference,
      inventory: snapshot,
      population,
      index: referenceIndex,
      resolutions,
      reviewResolutions,
    });
  }

  /**
   * Evaluates acknowledgements against one independent reference context.
   *
   * Coverage, exclusion conflicts, reviews, and cardinality all use this same claim/reference boundary.
   */
  private cover(
    context: IEvidenceGraphReferenceContext,
  ): IEvidenceGraphObligation {
    const {
      claim: {
        claim,
        inventory: claimInventory,
        population: claimPopulation,
        index: claimIndex,
      },
      reference,
      index: referenceIndex,
      inventory: referenceInventory,
      population: referencePopulation,
      resolutions,
    } = context;
    const declarations = new Map(
      claimInventory.declarations.map((declaration) => [
        declaration.id,
        declaration,
      ]),
    );
    const selectedHosts = new Map(
      claimPopulation.hosts.map((host) => [host.id, host.unitIds]),
    );
    const attachedHosts = new Set(
      claimInventory.hosts
        .filter((host) => host.attachment === "attached")
        .map((host) => host.id),
    );
    const exclusionHosts = new Set(
      claim.exclusionHostIds === undefined
        ? attachedHosts
        : claim.exclusionHostIds.filter((id) => attachedHosts.has(id)),
    );
    const units = new Map(
      referenceInventory.units.map((unit) => [unit.id, unit]),
    );
    const selectedUnits = referencePopulation.units;
    const selectedUnitIds = new Set(selectedUnits.map((unit) => unit.id));
    const scopeIds = new Set(referencePopulation.scopes.map((unit) => unit.id));
    const fingerprints = new EvidenceFingerprintIndex(referenceInventory);
    const checklist = reference.checklist === true;
    const explainedByHost = new Map<string, Set<string>>();
    const covered = new Set<string>();
    const edges: IEvidenceGraphEdge[] = [];
    for (const entry of resolutions) {
      const declaration = declarations.get(entry.declarationId);
      if (declaration === undefined) {
        this.diagnostics.push(
          this.problem(
            "graph-resolution-declaration",
            reference.severity,
            `Resolution '${entry.declarationId}' has no claim acknowledgement.`,
            "Rebuild target resolutions from this claim inventory before evaluating the graph.",
            claimIndex,
            referenceIndex,
          ),
        );
        continue;
      }
      if (entry.resolution.status !== "resolved") continue;
      const target = entry.resolution.units[0];
      if (
        target === undefined ||
        entry.resolution.units.length !== 1 ||
        !scopeIds.has(target.id)
      ) {
        this.diagnostics.push(
          this.problem(
            "graph-resolution-scope",
            reference.severity,
            `Resolved target '${declaration.target}' is outside this reference's selected structural scopes.`,
            "Resolve the declaration with this reference's exact selected unit IDs.",
            claimIndex,
            referenceIndex,
            declaration,
          ),
        );
        continue;
      }
      let unitIds = selectedUnits
        .filter((unit) => this.descends(unit, target.id, units))
        .map((unit) => unit.id);
      if (unitIds.length === 0) continue;
      const hostUnitIds = selectedHosts.get(declaration.hostId) ?? [];
      if (
        declaration.kind === "evidence" &&
        hostUnitIds.length === 0 &&
        checklist
      ) {
        this.recordUnhostedChecklist(
          declaration,
          reference.severity,
          claimIndex,
          referenceIndex,
        );
        continue;
      }
      if (
        (declaration.kind === "evidence" && hostUnitIds.length === 0) ||
        (declaration.kind === "evidenceExclude" &&
          !exclusionHosts.has(declaration.hostId))
      ) {
        this.diagnostics.push(
          this.problem(
            "graph-out-of-scope-host",
            reference.severity,
            `@${declaration.kind} for '${declaration.target}' is outside its eligible claim hosts.`,
            declaration.kind === "evidence"
              ? "Move the acknowledgement to a host selected by the claim's symbol kinds."
              : "Move the exclusion to an eligible public carrier in the claim files.",
            claimIndex,
            referenceIndex,
            declaration,
          ),
        );
        continue;
      }
      if (
        declaration.kind === "evidenceExclude" &&
        reference.noEvidenceExclude === true
      ) {
        this.diagnostics.push(
          this.problem(
            "graph-forbidden-exclusion",
            reference.severity,
            `@evidenceExclude for '${declaration.target}' is forbidden by noEvidenceExclude.`,
            "Remove the exclusion and cite the implemented target with positive @evidence.",
            claimIndex,
            referenceIndex,
            declaration,
          ),
        );
        continue;
      }
      if (checklist && hostUnitIds.length === 0) {
        this.recordUnhostedChecklist(
          declaration,
          reference.severity,
          claimIndex,
          referenceIndex,
        );
        continue;
      }
      if (
        checklist &&
        declaration.kind === "evidence" &&
        !selectedUnitIds.has(target.id)
      ) {
        this.answeredDeclarations.add(declaration.id);
        this.diagnostics.push(
          this.problem(
            "graph-checklist-aggregate",
            reference.severity,
            `Positive checklist target '${declaration.target}' names an unselected aggregate containing ${unitIds.length} selected item(s).`,
            "Cite each selected checklist item this host answers, or exclude the aggregate when none of it applies.",
            claimIndex,
            referenceIndex,
            declaration,
          ),
        );
        for (const hostUnitId of hostUnitIds) {
          let explained = explainedByHost.get(hostUnitId);
          if (explained === undefined) {
            explained = new Set<string>();
            explainedByHost.set(hostUnitId, explained);
          }
          for (const unitId of unitIds) explained.add(unitId);
        }
        continue;
      }
      if (checklist && declaration.kind === "evidence") unitIds = [target.id];
      this.conflicts(
        declaration,
        target.id,
        hostUnitIds,
        unitIds,
        edges,
        declarations,
        reference.severity,
        claimIndex,
        referenceIndex,
        checklist,
      );
      edges.push({
        declarationId: declaration.id,
        hostId: declaration.hostId,
        hostUnitIds,
        kind: declaration.kind,
        targetUnitId: target.id,
        unitIds,
        fingerprint: fingerprints.inspect(target.id).fingerprint,
      });
      this.answeredDeclarations.add(declaration.id);
      if (!checklist) for (const id of unitIds) covered.add(id);
    }
    this.evaluateReviews(context, edges);
    if (checklist)
      return this.checklistObligation(context, edges, explainedByHost);
    this.cardinality(context, edges);
    const coveredUnitIds = selectedUnits
      .filter((unit) => covered.has(unit.id))
      .map((unit) => unit.id);
    const missingUnits = selectedUnits.filter((unit) => !covered.has(unit.id));
    for (const unit of missingUnits)
      this.diagnostics.push(
        this.problem(
          "graph-missing-acknowledgement",
          reference.severity,
          `Missing acknowledgement for '${this.display(referenceInventory, unit)}'.`,
          reference.noEvidenceExclude === true
            ? "Cite the claim artifact that implements this unit with positive @evidence."
            : "Cite the claim artifact that implements this unit with @evidence, or exclude it on an eligible carrier when it does not apply.",
          claimIndex,
          referenceIndex,
          undefined,
          unit,
        ),
      );
    return this.obligation(
      claimIndex,
      referenceIndex,
      true,
      true,
      selectedUnits.map((unit) => unit.id),
      coveredUnitIds,
      missingUnits.map((unit) => unit.id),
      edges,
    );
  }

  /** Computes host-local checklist coverage and reports unanswered selected items. */
  private checklistObligation(
    context: IEvidenceGraphReferenceContext,
    edges: IEvidenceGraphEdge[],
    explainedByHost: Map<string, Set<string>>,
  ): IEvidenceGraphObligation {
    const {
      claim: {
        inventory: claimInventory,
        population: claimPopulation,
        index: claimIndex,
      },
      reference,
      index: referenceIndex,
      inventory: referenceInventory,
    } = context;
    const selectedUnits = context.population.units;
    const coveredByHost = new Map<string, Set<string>>(
      claimPopulation.units.map((unit) => [unit.id, new Set<string>()]),
    );
    for (const edge of edges)
      for (const hostUnitId of edge.hostUnitIds) {
        const covered = coveredByHost.get(hostUnitId);
        if (covered === undefined) continue;
        for (const unitId of edge.unitIds) covered.add(unitId);
      }
    const hostCoverage: IEvidenceGraphHostCoverage[] =
      claimPopulation.units.map((host) => {
        const covered = coveredByHost.get(host.id) ?? new Set<string>();
        const explained = explainedByHost.get(host.id) ?? new Set<string>();
        const coveredUnitIds = selectedUnits
          .filter((unit) => covered.has(unit.id))
          .map((unit) => unit.id);
        const missingUnits = selectedUnits.filter(
          (unit) => !covered.has(unit.id),
        );
        const explainedUnitIds = missingUnits
          .filter((unit) => explained.has(unit.id))
          .map((unit) => unit.id);
        const reportable = missingUnits.filter(
          (unit) => !explained.has(unit.id),
        );
        if (reportable.length !== 0)
          this.diagnostics.push(
            this.problem(
              "graph-checklist-missing",
              reference.severity,
              `Host '${this.display(claimInventory, host)}' has not acknowledged ${reportable.length} of ${selectedUnits.length} checklist item(s): ${reportable
                .map((unit) => `'${this.display(referenceInventory, unit)}'`)
                .join(", ")}.`,
              reference.noEvidenceExclude === true
                ? "Cite every missing checklist item from this host with positive @evidence."
                : "Cite every missing checklist item from this host, or exclude the scope that does not apply.",
              claimIndex,
              referenceIndex,
              undefined,
              host,
            ),
          );
        return {
          hostUnitId: host.id,
          coveredUnitIds,
          missingUnitIds: missingUnits.map((unit) => unit.id),
          explainedUnitIds,
        };
      });
    const coveredUnitIds = selectedUnits
      .filter((unit) =>
        hostCoverage.every((host) => host.coveredUnitIds.includes(unit.id)),
      )
      .map((unit) => unit.id);
    const covered = new Set(coveredUnitIds);
    return this.obligation(
      claimIndex,
      referenceIndex,
      true,
      true,
      selectedUnits.map((unit) => unit.id),
      coveredUnitIds,
      selectedUnits
        .filter((unit) => !covered.has(unit.id))
        .map((unit) => unit.id),
      edges,
      hostCoverage,
    );
  }

  /** Enforces singleEvidencePerSymbol and uniqueEvidence over positive semantic host coverage. */
  private cardinality(
    context: IEvidenceGraphReferenceContext,
    edges: IEvidenceGraphEdge[],
  ): void {
    const {
      claim: {
        inventory: claimInventory,
        population: claimPopulation,
        index: claimIndex,
      },
      reference,
      index: referenceIndex,
      inventory: referenceInventory,
    } = context;
    const selectedUnits = context.population.units;
    const evidence = edges.filter((edge) => edge.kind === "evidence");
    if (reference.singleEvidencePerSymbol === true)
      for (const host of claimPopulation.units) {
        const cited = new Set(
          evidence
            .filter((edge) => edge.hostUnitIds.includes(host.id))
            .flatMap((edge) => edge.unitIds),
        );
        if (cited.size === 1) continue;
        this.diagnostics.push(
          this.problem(
            "graph-single-evidence-per-symbol",
            reference.severity,
            `Host '${this.display(claimInventory, host)}' cites ${cited.size} distinct selected evidence unit(s); singleEvidencePerSymbol requires exactly 1.`,
            "Keep positive @evidence on this semantic host to exactly one selected unit.",
            claimIndex,
            referenceIndex,
            undefined,
            host,
          ),
        );
      }
    if (reference.uniqueEvidence === true)
      for (const unit of selectedUnits) {
        const hosts = new Set(
          evidence
            .filter((edge) => edge.unitIds.includes(unit.id))
            .flatMap((edge) => edge.hostUnitIds),
        );
        if (hosts.size <= 1) continue;
        this.diagnostics.push(
          this.problem(
            "graph-unique-evidence",
            reference.severity,
            `Evidence unit '${this.display(referenceInventory, unit)}' has ${hosts.size} distinct positive evidence host(s); uniqueEvidence allows at most 1.`,
            "Keep one selected semantic host for this unit and remove the other positive citations.",
            claimIndex,
            referenceIndex,
            undefined,
            unit,
          ),
        );
      }
  }

  /** Reports overlapping evidence and exclusion scopes under the current obligation policy. */
  private conflicts(
    declaration: IEvidenceDeclaration,
    targetUnitId: string,
    hostUnitIds: string[],
    unitIds: string[],
    edges: IEvidenceGraphEdge[],
    declarations: Map<string, IEvidenceDeclaration>,
    severity: EvidenceSeverity,
    claimIndex: number,
    referenceIndex: number,
    checklist: boolean,
  ): void {
    if (declaration.kind === "evidence") {
      const duplicate = edges.find(
        (edge) =>
          edge.kind === "evidence" &&
          this.overlaps(edge.hostUnitIds, hostUnitIds) &&
          edge.targetUnitId === targetUnitId,
      );
      if (duplicate !== undefined)
        this.diagnostics.push(
          this.problem(
            "graph-duplicate-evidence",
            severity,
            `The same host repeats @evidence for '${declaration.target}'.`,
            "Keep one acknowledgement for this target on the semantic host.",
            claimIndex,
            referenceIndex,
            declaration,
          ),
        );
    }
    const opposite = edges.find(
      (edge) =>
        edge.kind !== declaration.kind &&
        this.overlaps(edge.unitIds, unitIds) &&
        (!checklist || this.overlaps(edge.hostUnitIds, hostUnitIds)),
    );
    if (opposite !== undefined) {
      const previous = declarations.get(opposite.declarationId);
      this.diagnostics.push(
        this.problem(
          "graph-conflicting-acknowledgements",
          severity,
          `@evidence and @evidenceExclude overlap at '${declaration.target}'.`,
          previous === undefined
            ? "Delete whichever acknowledgement states the wrong intent."
            : `Delete whichever acknowledgement states the wrong intent; the earlier declaration is '${previous.target}'.`,
          claimIndex,
          referenceIndex,
          declaration,
        ),
      );
    }
    if (declaration.kind === "evidenceExclude") {
      const duplicate = edges.find(
        (edge) =>
          edge.kind === "evidenceExclude" &&
          this.overlaps(edge.unitIds, unitIds) &&
          (!checklist || this.overlaps(edge.hostUnitIds, hostUnitIds)),
      );
      if (duplicate !== undefined)
        this.diagnostics.push(
          this.problem(
            "graph-duplicate-exclusion",
            severity,
            `@evidenceExclude for '${declaration.target}' overlaps an earlier exclusion.`,
            "Keep one exclusion at the widest truthful scope.",
            claimIndex,
            referenceIndex,
            declaration,
          ),
        );
    }
  }

  /**
   * Pairs reviews with acknowledgements by kind, host, and resolved target.
   *
   * Reviews validate fingerprints but never discharge missing coverage.
   */
  private evaluateReviews(
    context: IEvidenceGraphReferenceContext,
    edges: IEvidenceGraphEdge[],
  ): void {
    const {
      claim: { inventory: claimInventory, index: claimIndex },
      reference,
      index: referenceIndex,
      inventory: referenceInventory,
      population: referencePopulation,
      resolutions: declarationResolutions,
      reviewResolutions,
    } = context;
    const declarations = new Map(
      claimInventory.declarations.map((declaration) => [
        declaration.id,
        declaration,
      ]),
    );
    const reviews = new Map(
      claimInventory.reviews.map((review) => [review.id, review]),
    );
    const hosts = new Map(claimInventory.hosts.map((host) => [host.id, host]));
    const scopeIds = new Set(referencePopulation.scopes.map((unit) => unit.id));
    const acknowledgements: IEvidenceResolvedAcknowledgement[] = [];
    for (const entry of declarationResolutions) {
      const declaration = declarations.get(entry.declarationId);
      const target = entry.resolution.units[0];
      if (
        declaration === undefined ||
        entry.resolution.status !== "resolved" ||
        target === undefined ||
        entry.resolution.units.length !== 1 ||
        !scopeIds.has(target.id)
      )
        continue;
      const host = hosts.get(declaration.hostId);
      acknowledgements.push({
        declaration,
        hostUnitIds: host?.attachment === "attached" ? host.unitIds : [],
        targetUnitId: target.id,
      });
    }
    const records: IEvidenceResolvedReview[] = [];
    const duplicateKeys = new Set<string>();
    for (const entry of reviewResolutions) {
      const review = reviews.get(entry.reviewId);
      if (review === undefined) {
        this.diagnostics.push(
          this.problem(
            "graph-review-resolution-review",
            reference.severity,
            `Review resolution '${entry.reviewId}' has no claim review statement.`,
            "Rebuild review target resolutions from this claim inventory before evaluating the graph.",
            claimIndex,
            referenceIndex,
          ),
        );
        continue;
      }
      if (entry.resolution.status !== "resolved") continue;
      const target = entry.resolution.units[0];
      if (
        target === undefined ||
        entry.resolution.units.length !== 1 ||
        !scopeIds.has(target.id)
      ) {
        this.diagnostics.push(
          this.problem(
            "graph-review-resolution-scope",
            reference.severity,
            `Resolved review target '${review.target}' is outside this reference's selected structural scopes.`,
            "Resolve the review with this reference's exact selected unit IDs.",
            claimIndex,
            referenceIndex,
            review,
          ),
        );
        continue;
      }
      const host = hosts.get(review.hostId);
      const hostUnitIds = host?.attachment === "attached" ? host.unitIds : [];
      const key = JSON.stringify([review.hostId, review.reviews, target.id]);
      if (duplicateKeys.has(key)) {
        this.diagnostics.push(
          this.problem(
            "graph-duplicate-review",
            reference.severity,
            `The same documentation position repeats ${this.reviewMarker(review.reviews)} for '${review.target}'.`,
            "Keep the review that states what was checked and remove the other.",
            claimIndex,
            referenceIndex,
            review,
          ),
        );
        continue;
      }
      duplicateKeys.add(key);
      records.push({ review, hostUnitIds, targetUnitId: target.id });
    }
    for (const record of records) {
      const matching = acknowledgements.some(
        (acknowledgement) =>
          acknowledgement.declaration.kind === record.review.reviews &&
          acknowledgement.targetUnitId === record.targetUnitId &&
          this.reviewHostMatches(
            record,
            acknowledgement.declaration.hostId,
            acknowledgement.hostUnitIds,
          ),
      );
      if (matching) continue;
      const opposite = acknowledgements.find(
        (acknowledgement) =>
          acknowledgement.declaration.kind !== record.review.reviews &&
          acknowledgement.targetUnitId === record.targetUnitId &&
          this.reviewHostMatches(
            record,
            acknowledgement.declaration.hostId,
            acknowledgement.hostUnitIds,
          ),
      );
      this.diagnostics.push(
        opposite === undefined
          ? this.problem(
              "graph-orphan-review",
              reference.severity,
              `${this.reviewMarker(record.review.reviews)} for '${record.review.target}' has no matching acknowledgement on its semantic host.`,
              `Correct the target, add @${record.review.reviews} when this host answers it, or remove the review.`,
              claimIndex,
              referenceIndex,
              record.review,
            )
          : this.problem(
              "graph-review-kind",
              reference.severity,
              `${this.reviewMarker(record.review.reviews)} for '${record.review.target}' cannot review @${opposite.declaration.kind}.`,
              `Rewrite it as ${this.reviewMarker(opposite.declaration.kind)}, or correct the acknowledgement kind.`,
              claimIndex,
              referenceIndex,
              record.review,
            ),
      );
    }
    if (reference.requireReview !== true) return;
    for (const edge of edges) {
      const candidates = records.filter(
        (record) =>
          record.review.reviews === edge.kind &&
          record.targetUnitId === edge.targetUnitId &&
          this.reviewHostMatches(record, edge.hostId, edge.hostUnitIds),
      );
      const review = candidates[0]?.review;
      const marker = this.reviewMarker(edge.kind);
      const declaration = claimInventory.declarations.find(
        (candidate) => candidate.id === edge.declarationId,
      );
      if (review === undefined) {
        const wrongKind = records.some(
          (record) =>
            record.review.reviews !== edge.kind &&
            record.targetUnitId === edge.targetUnitId &&
            this.reviewHostMatches(record, edge.hostId, edge.hostUnitIds),
        );
        if (wrongKind) continue;
        this.diagnostics.push(
          this.problem(
            "graph-missing-review",
            reference.severity,
            `@${edge.kind} for '${declaration?.target ?? this.displayUnit(referenceInventory, edge.targetUnitId)}' has no matching ${marker}; the current scope fingerprint is '#${edge.fingerprint}'.`,
            `Add '${marker} ${declaration?.target ?? "<target>"} #${edge.fingerprint} <what you checked>' on the same semantic host.`,
            claimIndex,
            referenceIndex,
            declaration,
          ),
        );
        continue;
      }
      if (review.fingerprint === undefined) {
        this.diagnostics.push(
          this.problem(
            "graph-missing-review-fingerprint",
            reference.severity,
            `${marker} for '${review.target}' has no fingerprint; the current scope fingerprint is '#${edge.fingerprint}'.`,
            `Write '#${edge.fingerprint}' after the review target so later content changes can expire it.`,
            claimIndex,
            referenceIndex,
            review,
          ),
        );
        continue;
      }
      if (review.fingerprint !== edge.fingerprint)
        this.diagnostics.push(
          this.problem(
            "graph-stale-review",
            reference.severity,
            `${marker} for '${review.target}' names '#${review.fingerprint}', but the current scope fingerprint is '#${edge.fingerprint}'.`,
            `Review the cited content again and replace the fingerprint with '#${edge.fingerprint}', or correct the acknowledgement if it no longer applies.`,
            claimIndex,
            referenceIndex,
            review,
          ),
        );
    }
  }

  /** Tests whether a review belongs to the acknowledgement's semantic host population. */
  private reviewHostMatches(
    review: IEvidenceResolvedReview,
    hostId: string,
    hostUnitIds: string[],
  ): boolean {
    return review.hostUnitIds.length === 0
      ? review.review.hostId === hostId
      : this.overlaps(review.hostUnitIds, hostUnitIds);
  }

  /** Selects the review tag corresponding to a positive or exclusion acknowledgement. */
  private reviewMarker(kind: EvidenceAcknowledgementKind): string {
    return kind === "evidence" ? "@evidenceReview" : "@evidenceExcludeReview";
  }

  /** Formats a known unit identity for a diagnostic or retains an unknown identity verbatim. */
  private displayUnit(inventory: IEvidenceInventory, id: string): string {
    const unit = inventory.units.find((candidate) => candidate.id === id);
    return unit === undefined ? id : this.display(inventory, unit);
  }

  /** Validates and orders acknowledgement resolutions within one reference obligation. */
  private resolutions(
    inventory: IEvidenceInventory,
    reference: IEvidenceGraphReference,
    claimIndex: number,
    referenceIndex: number,
  ): IEvidenceGraphResolution[] {
    const declarations = new Map(
      inventory.declarations.map((declaration) => [
        declaration.id,
        declaration,
      ]),
    );
    const records = new Map<string, IEvidenceGraphResolution>();
    const conflicts = new Set<string>();
    for (const entry of reference.resolutions) {
      if (conflicts.has(entry.declarationId)) continue;
      const previous = records.get(entry.declarationId);
      if (
        previous !== undefined &&
        typia.json.stringify(previous.resolution) !==
          typia.json.stringify(entry.resolution)
      ) {
        this.diagnostics.push(
          this.problem(
            "graph-conflicting-resolution",
            reference.severity,
            `Acknowledgement '${entry.declarationId}' has conflicting target resolutions.`,
            "Resolve each acknowledgement once per reference population.",
            claimIndex,
            referenceIndex,
            declarations.get(entry.declarationId),
          ),
        );
        records.delete(entry.declarationId);
        conflicts.add(entry.declarationId);
      } else records.set(entry.declarationId, entry);
    }
    return Array.from(records.values()).sort((x, y) =>
      this.compareStatements(
        declarations.get(x.declarationId),
        declarations.get(y.declarationId),
        x.declarationId,
        y.declarationId,
      ),
    );
  }

  /** Validates and orders review resolutions without combining them with acknowledgements. */
  private reviewResolutions(
    inventory: IEvidenceInventory,
    reference: IEvidenceGraphReference,
    claimIndex: number,
    referenceIndex: number,
  ): IEvidenceGraphReviewResolution[] {
    const reviews = new Map(
      inventory.reviews.map((review) => [review.id, review]),
    );
    const records = new Map<string, IEvidenceGraphReviewResolution>();
    const conflicts = new Set<string>();
    for (const entry of reference.reviewResolutions ?? []) {
      if (conflicts.has(entry.reviewId)) continue;
      const previous = records.get(entry.reviewId);
      if (
        previous !== undefined &&
        typia.json.stringify(previous.resolution) !==
          typia.json.stringify(entry.resolution)
      ) {
        this.diagnostics.push(
          this.problem(
            "graph-conflicting-review-resolution",
            reference.severity,
            `Review '${entry.reviewId}' has conflicting target resolutions.`,
            "Resolve each review once per reference population.",
            claimIndex,
            referenceIndex,
            reviews.get(entry.reviewId),
          ),
        );
        records.delete(entry.reviewId);
        conflicts.add(entry.reviewId);
      } else records.set(entry.reviewId, entry);
    }
    return Array.from(records.values()).sort((x, y) =>
      this.compareStatements(
        reviews.get(x.reviewId),
        reviews.get(y.reviewId),
        x.reviewId,
        y.reviewId,
      ),
    );
  }

  /** Orders annotations by their source coordinates and stable identities. */
  private compareStatements(
    x: IEvidenceTargetStatement | undefined,
    y: IEvidenceTargetStatement | undefined,
    xId: string,
    yId: string,
  ): number {
    const xLocation = x === undefined ? undefined : x.location;
    const yLocation = y === undefined ? undefined : y.location;
    const xOffset =
      xLocation?.range === undefined ? -1 : xLocation.range.start.offset;
    const yOffset =
      yLocation?.range === undefined ? -1 : yLocation.range.start.offset;
    const xKey = JSON.stringify([xLocation?.file ?? "", xOffset, xId]);
    const yKey = JSON.stringify([yLocation?.file ?? "", yOffset, yId]);
    return InventoryMerge.compare(xKey, yKey);
  }

  /** Tests structural ancestry while bounding traversal through malformed parent cycles. */
  private descends(
    unit: IEvidenceUnit,
    ancestorId: string,
    units: Map<string, IEvidenceUnit>,
  ): boolean {
    const visited = new Set<string>();
    let current: IEvidenceUnit | undefined = unit;
    while (current !== undefined && !visited.has(current.id)) {
      if (current.id === ancestorId) return true;
      visited.add(current.id);
      current =
        current.parentId === undefined
          ? undefined
          : units.get(current.parentId);
    }
    return false;
  }

  /** Tests whether two identity collections share at least one member. */
  private overlaps(x: string[], y: string[]): boolean {
    const right = new Set(y);
    return x.some((id) => right.has(id));
  }

  /** Formats the preferred public address of a semantic unit for diagnostics. */
  private display(inventory: IEvidenceInventory, unit: IEvidenceUnit): string {
    const selectedFiles = new Set(
      inventory.sources.flatMap((source) =>
        source.addresses.flatMap((address) =>
          address.selected === false
            ? []
            : [EvidenceFileTarget.normalize(address.absolute)],
        ),
      ),
    );
    const addresses = inventory.addresses
      .filter((address) => address.unitId === unit.id)
      .sort((x, y) =>
        InventoryMerge.compare(
          JSON.stringify([x.file, x.segments]),
          JSON.stringify([y.file, y.segments]),
        ),
      );
    const address =
      addresses.find((candidate) =>
        selectedFiles.has(EvidenceFileTarget.normalize(candidate.file)),
      ) ?? addresses[0];
    if (address === undefined) return unit.name;
    return address.segments.length === 0
      ? address.file
      : EvidenceFileTarget.format(address);
  }

  /** Applies an obligation's severity and configured coordinates to an existing diagnostic. */
  private context(
    diagnostic: IEvidenceDiagnostic,
    severity: EvidenceSeverity,
    claim: number,
    reference?: number,
  ): IEvidenceDiagnostic {
    if (severity === "off")
      throw new Error("Disabled graph state cannot emit a diagnostic.");
    return {
      ...diagnostic,
      severity,
      message: `${this.label(claim, reference)}: ${diagnostic.message}`,
      claim: this.claimIndex(claim),
      ...(reference === undefined
        ? {}
        : { reference: this.referenceIndex(claim, reference) }),
    };
  }

  /** Creates a graph diagnostic with the most specific available annotation or unit location. */
  private problem(
    code: string,
    severity: EvidenceSeverity,
    message: string,
    repair: string,
    claim: number,
    reference: number,
    statement?: IEvidenceTargetStatement,
    unit?: IEvidenceUnit,
  ): IEvidenceDiagnostic {
    if (severity === "off")
      throw new Error("Disabled graph state cannot emit a diagnostic.");
    const site = unit === undefined ? undefined : unit.sites[0];
    return {
      code,
      severity,
      message: `${this.label(claim, reference)}: ${message}`,
      repair,
      claim: this.claimIndex(claim),
      reference: this.referenceIndex(claim, reference),
      ...(statement === undefined
        ? site === undefined
          ? {}
          : { location: { file: site.file, range: site.range } }
        : {
            location: statement.location,
            hostId: statement.hostId,
            target: statement.target,
          }),
    };
  }

  /** Formats the configured claim name and reference position for diagnostic messages. */
  private label(claim: number, reference?: number): string {
    const input = this.input.claims[claim];
    const name = input?.name;
    const configuredClaim = this.claimIndex(claim);
    const label =
      name === undefined || name.length === 0
        ? `Claim ${configuredClaim + 1}`
        : `Claim ${configuredClaim + 1} ('${name}')`;
    return reference === undefined
      ? label
      : `${label} reference ${this.referenceIndex(claim, reference) + 1}`;
  }

  /** Maps an input claim position to its configured stable index. */
  private claimIndex(position: number): number {
    return this.input.claims[position]?.index ?? position;
  }

  /** Maps a reference position to its configured stable index within the claim. */
  private referenceIndex(claim: number, position: number): number {
    const input = this.input.claims[claim];
    return input === undefined
      ? position
      : (input.references[position]?.index ?? position);
  }

  /** Rejects incompatible checklist and cardinality policies before coverage evaluation. */
  private validateReferencePolicy(
    claim: IEvidenceGraphClaim,
    reference: IEvidenceGraphReference,
    population: IEvidencePopulation,
    claimIndex: number,
    referenceIndex: number,
  ): void {
    if (reference.checklist !== true) return;
    if (
      reference.uniqueEvidence === true ||
      reference.singleEvidencePerSymbol === true
    )
      throw new Error(
        `${this.label(claimIndex, referenceIndex)} combines checklist with an incompatible cardinality policy.`,
      );
    if (
      (claim.exclusionHostIds?.length ?? 0) !== 0 &&
      reference.noEvidenceExclude !== true
    )
      throw new Error(
        `${this.label(claimIndex, referenceIndex)} combines checklist with gathered exclusion carriers.`,
      );
    if (population.units.some((unit) => unit.type !== "markdown"))
      throw new Error(
        `${this.label(claimIndex, referenceIndex)} applies checklist to a non-Markdown reference population.`,
      );
  }

  /** Defers an unhosted checklist finding until all applicable references have been evaluated. */
  private recordUnhostedChecklist(
    declaration: IEvidenceDeclaration,
    severity: EvidenceSeverity,
    claim: number,
    reference: number,
  ): void {
    const previous = this.unhostedChecklists.get(declaration.id);
    if (
      previous === undefined ||
      (previous.severity === "warning" && severity === "error")
    )
      this.unhostedChecklists.set(declaration.id, {
        declaration,
        severity,
        claim,
        reference,
      });
  }

  /** Reports deferred checklist annotations that remain unanswered and are not uncertain. */
  private reportUnhostedChecklists(): void {
    for (const record of this.unhostedChecklists.values()) {
      if (
        this.answeredDeclarations.has(record.declaration.id) ||
        this.uncertainDeclarations.has(record.declaration.id)
      )
        continue;
      this.diagnostics.push(
        this.problem(
          "graph-unhosted-checklist",
          record.severity,
          `@${record.declaration.kind} for '${record.declaration.target}' is not attached to a selected checklist host.`,
          "Move the acknowledgement onto a selected semantic host that owes this checklist item.",
          record.claim,
          record.reference,
          record.declaration,
        ),
      );
    }
  }

  /** Creates a successful inactive result without evaluating reference coverage. */
  private inactiveObligation(
    claim: number,
    reference: number,
    input: IEvidenceGraphReference,
  ): IEvidenceGraphObligation {
    return this.obligation(
      claim,
      reference,
      false,
      true,
      input.unitIds,
      [],
      [],
    );
  }

  /** Preserves an active obligation whose coverage cannot be evaluated completely. */
  private incompleteObligation(
    claim: number,
    reference: number,
    input: IEvidenceGraphReference,
  ): IEvidenceGraphObligation {
    return this.obligation(
      claim,
      reference,
      input.severity !== "off",
      false,
      input.unitIds,
      [],
      [],
    );
  }

  /** Builds the stable result for one configured claim/reference obligation. */
  private obligation(
    claim: number,
    reference: number,
    active: boolean,
    complete: boolean,
    unitIds: string[],
    coveredUnitIds: string[],
    missingUnitIds: string[],
    edges: IEvidenceGraphEdge[] = [],
    hostCoverage: IEvidenceGraphHostCoverage[] = [],
  ): IEvidenceGraphObligation {
    return {
      claim: this.claimIndex(claim),
      reference: this.referenceIndex(claim, reference),
      active,
      complete,
      unitIds,
      coveredUnitIds,
      missingUnitIds,
      edges,
      hostCoverage,
    };
  }
}
