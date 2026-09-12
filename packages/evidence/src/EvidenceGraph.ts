import typia from "typia";

import { EvidenceFileTarget } from "./EvidenceFileTarget";
import { EvidenceInventory } from "./EvidenceInventory";
import { InventoryMerge } from "./internal/InventoryMerge";
import type { IEvidenceDeclaration } from "./structures/IEvidenceDeclaration";
import type { IEvidenceDiagnostic } from "./structures/IEvidenceDiagnostic";
import type { IEvidenceGraphClaim } from "./structures/IEvidenceGraphClaim";
import type { IEvidenceGraphClaimResult } from "./structures/IEvidenceGraphClaimResult";
import type { IEvidenceGraphEdge } from "./structures/IEvidenceGraphEdge";
import type { IEvidenceGraphInput } from "./structures/IEvidenceGraphInput";
import type { IEvidenceGraphObligation } from "./structures/IEvidenceGraphObligation";
import type { IEvidenceGraphReference } from "./structures/IEvidenceGraphReference";
import type { IEvidenceGraphResolution } from "./structures/IEvidenceGraphResolution";
import type { IEvidenceGraphResult } from "./structures/IEvidenceGraphResult";
import type { IEvidenceInventory } from "./structures/IEvidenceInventory";
import type { IEvidencePopulation } from "./structures/IEvidencePopulation";
import type { IEvidenceUnit } from "./structures/IEvidenceUnit";
import type { EvidenceSeverity } from "./typings/EvidenceSeverity";

/** Evaluates independent claim/reference coverage over materialized inventories. */
export namespace EvidenceGraph {
  export function evaluate(input: IEvidenceGraphInput): IEvidenceGraphResult {
    return new GraphEvaluator(structuredClone(typia.assert(input))).evaluate();
  }
}

class GraphEvaluator {
  private readonly diagnostics: IEvidenceDiagnostic[] = [];

  public constructor(private readonly input: IEvidenceGraphInput) {}

  public evaluate(): IEvidenceGraphResult {
    const claims = this.input.claims.map((claim, index) =>
      this.evaluateClaim(claim, index),
    );
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

  private evaluateClaim(
    claim: IEvidenceGraphClaim,
    claimIndex: number,
  ): IEvidenceGraphClaimResult {
    if (claim.severity === "off")
      return {
        claim: claimIndex,
        active: false,
        complete: true,
        obligations: claim.references.map((reference, referenceIndex) =>
          this.inactiveObligation(claimIndex, referenceIndex, reference),
        ),
      };
    const inventory = new EvidenceInventory([claim.inventory]);
    const snapshot = inventory.snapshot();
    const population = inventory.select(claim.unitIds);
    this.diagnostics.push(
      ...snapshot.diagnostics.map((diagnostic) =>
        this.context(diagnostic, claim.severity, claimIndex),
      ),
    );
    if (snapshot.complete && population.units.length === 0)
      return {
        claim: claimIndex,
        active: false,
        complete: true,
        obligations: claim.references.map((reference, referenceIndex) =>
          this.inactiveObligation(claimIndex, referenceIndex, reference),
        ),
      };
    const obligations = claim.references.map((reference, referenceIndex) =>
      snapshot.complete
        ? this.evaluateReference(
            claim,
            snapshot,
            population,
            claimIndex,
            reference,
            referenceIndex,
          )
        : this.incompleteObligation(claimIndex, referenceIndex, reference),
    );
    return {
      claim: claimIndex,
      active: true,
      complete: snapshot.complete,
      obligations,
    };
  }

  private evaluateReference(
    claim: IEvidenceGraphClaim,
    claimInventory: IEvidenceInventory,
    claimPopulation: IEvidencePopulation,
    claimIndex: number,
    reference: IEvidenceGraphReference,
    referenceIndex: number,
  ): IEvidenceGraphObligation {
    if (reference.severity === "off")
      return this.inactiveObligation(claimIndex, referenceIndex, reference);
    const inventory = new EvidenceInventory([reference.inventory]);
    const snapshot = inventory.snapshot();
    const population = inventory.select(reference.unitIds);
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
    if (resolutions.some((entry) => entry.resolution.status === "incomplete"))
      return this.obligation(
        claimIndex,
        referenceIndex,
        true,
        false,
        unitIds,
        [],
        [],
      );
    return this.cover(
      claim,
      claimInventory,
      claimPopulation,
      claimIndex,
      reference,
      referenceIndex,
      snapshot,
      population,
      resolutions,
    );
  }

  private cover(
    claim: IEvidenceGraphClaim,
    claimInventory: IEvidenceInventory,
    claimPopulation: IEvidencePopulation,
    claimIndex: number,
    reference: IEvidenceGraphReference,
    referenceIndex: number,
    referenceInventory: IEvidenceInventory,
    referencePopulation: IEvidencePopulation,
    resolutions: IEvidenceGraphResolution[],
  ): IEvidenceGraphObligation {
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
    const scopeIds = new Set(referencePopulation.scopes.map((unit) => unit.id));
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
      const unitIds = selectedUnits
        .filter((unit) => this.descends(unit, target.id, units))
        .map((unit) => unit.id);
      if (unitIds.length === 0) continue;
      const hostUnitIds = selectedHosts.get(declaration.hostId) ?? [];
      const eligible =
        declaration.kind === "evidence"
          ? hostUnitIds.length !== 0
          : exclusionHosts.has(declaration.hostId);
      if (!eligible) {
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
      );
      edges.push({
        declarationId: declaration.id,
        hostId: declaration.hostId,
        hostUnitIds,
        kind: declaration.kind,
        targetUnitId: target.id,
        unitIds,
      });
      for (const id of unitIds) covered.add(id);
    }
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
        edge.kind !== declaration.kind && this.overlaps(edge.unitIds, unitIds),
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
          this.overlaps(edge.unitIds, unitIds),
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
      this.compareDeclarations(
        declarations.get(x.declarationId),
        declarations.get(y.declarationId),
        x.declarationId,
        y.declarationId,
      ),
    );
  }

  private compareDeclarations(
    x: IEvidenceDeclaration | undefined,
    y: IEvidenceDeclaration | undefined,
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

  private overlaps(x: string[], y: string[]): boolean {
    const right = new Set(y);
    return x.some((id) => right.has(id));
  }

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
      claim,
      ...(reference === undefined ? {} : { reference }),
    };
  }

  private problem(
    code: string,
    severity: EvidenceSeverity,
    message: string,
    repair: string,
    claim: number,
    reference: number,
    declaration?: IEvidenceDeclaration,
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
      claim,
      reference,
      ...(declaration === undefined
        ? site === undefined
          ? {}
          : { location: { file: site.file, range: site.range } }
        : {
            location: declaration.location,
            hostId: declaration.hostId,
            target: declaration.target,
          }),
    };
  }

  private label(claim: number, reference?: number): string {
    const name = this.input.claims[claim]?.name;
    const label =
      name === undefined || name.length === 0
        ? `Claim ${claim + 1}`
        : `Claim ${claim + 1} ('${name}')`;
    return reference === undefined
      ? label
      : `${label} reference ${reference + 1}`;
  }

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

  private obligation(
    claim: number,
    reference: number,
    active: boolean,
    complete: boolean,
    unitIds: string[],
    coveredUnitIds: string[],
    missingUnitIds: string[],
    edges: IEvidenceGraphEdge[] = [],
  ): IEvidenceGraphObligation {
    return {
      claim,
      reference,
      active,
      complete,
      unitIds,
      coveredUnitIds,
      missingUnitIds,
      edges,
    };
  }
}
