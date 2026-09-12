import path from "node:path";

import { EvidenceFileTarget } from "./EvidenceFileTarget";
import { EvidenceFingerprint } from "./EvidenceFingerprint";
import { EvidenceLanguageRegistry } from "./EvidenceLanguageRegistry";
import { EvidenceTargetResolver } from "./EvidenceTargetResolver";
import { InventoryMerge } from "./internal/InventoryMerge";
import type { IEvidenceQueryPopulation } from "./internal/IEvidenceQueryPopulation";
import { MarkdownTarget } from "./internal/MarkdownTarget";
import type { IEvidenceCheckAnalysis } from "./structures/IEvidenceCheckAnalysis";
import type { IEvidenceDeclaration } from "./structures/IEvidenceDeclaration";
import type { IEvidenceDiagnostic } from "./structures/IEvidenceDiagnostic";
import type { IEvidenceGraphBoundary } from "./structures/IEvidenceGraphBoundary";
import type { IEvidenceGraphExportEdge } from "./structures/IEvidenceGraphExportEdge";
import type { IEvidenceGraphExportReview } from "./structures/IEvidenceGraphExportReview";
import type { IEvidenceGraphHostNode } from "./structures/IEvidenceGraphHostNode";
import type { IEvidenceGraphNode } from "./structures/IEvidenceGraphNode";
import type { IEvidenceGraphPolicy } from "./structures/IEvidenceGraphPolicy";
import type { IEvidenceGraphReference } from "./structures/IEvidenceGraphReference";
import type { IEvidenceGraphReport } from "./structures/IEvidenceGraphReport";
import type { IEvidenceHost } from "./structures/IEvidenceHost";
import type { IEvidenceInspection } from "./structures/IEvidenceInspection";
import type { IEvidenceInspectReport } from "./structures/IEvidenceInspectReport";
import type { IEvidenceInspectedAcknowledgement } from "./structures/IEvidenceInspectedAcknowledgement";
import type { IEvidenceInspectedObligation } from "./structures/IEvidenceInspectedObligation";
import type { IEvidenceInspectedReview } from "./structures/IEvidenceInspectedReview";
import type { IEvidenceInspectedUnit } from "./structures/IEvidenceInspectedUnit";
import type { IEvidenceLanguagesReport } from "./structures/IEvidenceLanguagesReport";
import type { IEvidenceListItem } from "./structures/IEvidenceListItem";
import type { IEvidenceListReport } from "./structures/IEvidenceListReport";
import type { IEvidenceQueryScope } from "./structures/IEvidenceQueryScope";
import type { IEvidenceReview } from "./structures/IEvidenceReview";
import type { IEvidenceSourceLocation } from "./structures/IEvidenceSourceLocation";
import type { IEvidenceTargetStatement } from "./structures/IEvidenceTargetStatement";
import type { IEvidenceUnit } from "./structures/IEvidenceUnit";
import type { EvidenceArtifactType } from "./typings/EvidenceArtifactType";
import type { EvidenceCommandExitCode } from "./typings/EvidenceCommandExitCode";
import type { EvidenceGraphNode } from "./typings/EvidenceGraphNode";
import type { EvidenceSymbol } from "./typings/EvidenceSymbol";
import type { EvidenceUnitSelection } from "./typings/EvidenceUnitSelection";

/** Builds target discovery, inspection, language, and graph reports from one analysis. */
export namespace EvidenceQuery {
  /** Lists selected evidence identities and their addressable ancestors. */
  export function list(
    analysis: IEvidenceCheckAnalysis,
    cwd: string,
    language?: EvidenceArtifactType,
    kind?: EvidenceSymbol,
  ): IEvidenceListReport {
    const root = path.resolve(cwd);
    const items = populations(analysis)
      .flatMap((population) => listPopulation(population, root))
      .filter(
        (item) =>
          (language === undefined || item.scope.type === language) &&
          (kind === undefined || item.symbol === kind),
      )
      .sort((left, right) => compare(left.id, right.id));
    return {
      schemaVersion: 1,
      command: "list",
      configFile: analysis.report.configFile,
      status: analysis.report.status,
      success: analysis.report.success,
      exitCode: analysis.report.exitCode,
      ...(language === undefined ? {} : { language }),
      ...(kind === undefined ? {} : { kind }),
      total: items.length,
      items,
      diagnostics: analysis.report.diagnostics,
    };
  }

  /** Resolves one CLI-relative target against every applicable configured population. */
  export async function inspect(
    analysis: IEvidenceCheckAnalysis,
    cwd: string,
    target: string,
  ): Promise<IEvidenceInspectReport> {
    const root = path.resolve(cwd);
    const all = populations(analysis);
    const exact = new Set(
      all.flatMap((population) =>
        populationHasTarget(population, target, root)
          ? [scopeId(population.scope)]
          : [],
      ),
    );
    const selected =
      exact.size === 0
        ? applicablePopulations(all, target)
        : all.filter((population) => exact.has(scopeId(population.scope)));
    const inspections = (
      await Promise.all(
        selected.map((population) =>
          inspectPopulation(analysis, population, root, target),
        ),
      )
    ).sort((left, right) => compare(scopeId(left.scope), scopeId(right.scope)));
    const diagnostics = uniqueDiagnostics([
      ...analysis.report.diagnostics,
      ...inspections.flatMap((inspection) => inspection.diagnostics),
    ]);
    const resolved =
      inspections.length !== 0 &&
      inspections.every((inspection) => inspection.status === "resolved");
    const incomplete =
      analysis.report.status === "incomplete" ||
      inspections.some((inspection) => inspection.status === "incomplete");
    const exitCode: EvidenceCommandExitCode = incomplete
      ? 2
      : !resolved
        ? 1
        : analysis.report.exitCode;
    return {
      schemaVersion: 1,
      command: "inspect",
      configFile: analysis.report.configFile,
      status: incomplete ? "incomplete" : "complete",
      success: resolved && exitCode === 0,
      exitCode,
      target,
      inspections,
      diagnostics,
    };
  }

  /** Exports independent obligation boundaries, identities, edges, and reviews. */
  export function graph(
    analysis: IEvidenceCheckAnalysis,
    cwd: string,
  ): IEvidenceGraphReport {
    const root = path.resolve(cwd);
    const configured = populations(analysis);
    const nodes = new Map<string, EvidenceGraphNode>();
    const boundaries: IEvidenceGraphBoundary[] = [];
    const edges: IEvidenceGraphExportEdge[] = [];
    const reviews: IEvidenceGraphExportReview[] = [];

    analysis.graphInput.claims.forEach((claim, claimPosition) => {
      const reportClaim = requireReportClaim(analysis, claimPosition);
      const claimPopulation = requirePopulation(
        configured,
        "claim",
        reportClaim.claim,
      );
      claim.references.forEach((reference, referencePosition) => {
        const reportObligation = requireReportObligation(
          analysis,
          claimPosition,
          referencePosition,
        );
        const obligation = requireResultObligation(
          analysis,
          claimPosition,
          referencePosition,
        );
        const referencePopulation = requirePopulation(
          configured,
          "reference",
          reportClaim.claim,
          reportObligation.reference,
        );
        const boundaryId = boundary(
          reportClaim.claim,
          reportObligation.reference,
        );
        boundaries.push({
          id: boundaryId,
          claim: claimPopulation.scope,
          reference: referencePopulation.scope,
          policy: graphPolicy(reference),
          active: obligation.active,
          complete: obligation.complete,
          unitIds: obligation.unitIds,
          coveredUnitIds: obligation.coveredUnitIds,
          missingUnitIds: obligation.missingUnitIds,
          hostCoverage: obligation.hostCoverage,
        });

        for (const item of listPopulation(claimPopulation, root))
          if (item.selection === "selected")
            nodes.set(
              graphUnitNodeId(boundaryId, "claim", item.unitId),
              graphUnitNode(
                boundaryId,
                "claim",
                item,
                obligation.edges.some((edge) =>
                  edge.hostUnitIds.includes(item.unitId),
                ),
                false,
              ),
            );
        for (const item of listPopulation(referencePopulation, root))
          nodes.set(
            graphUnitNodeId(boundaryId, "reference", item.unitId),
            graphUnitNode(
              boundaryId,
              "reference",
              item,
              covered(referencePopulation, item.unitId),
              missing(referencePopulation, item.unitId),
            ),
          );

        for (const edge of obligation.edges) {
          const declaration = requireDeclaration(
            claim.inventory,
            edge.declarationId,
          );
          const sourceNodeIds = graphSourceNodes(
            nodes,
            boundaryId,
            claimPopulation,
            declaration.hostId,
            edge.hostUnitIds,
            root,
          );
          const targetNodeId = graphUnitNodeId(
            boundaryId,
            "reference",
            edge.targetUnitId,
          );
          ensureUnitNode(
            nodes,
            boundaryId,
            "reference",
            referencePopulation,
            edge.targetUnitId,
            root,
          );
          edges.push({
            id: `${boundaryId}:edge:${edge.declarationId}:${edge.targetUnitId}`,
            boundaryId,
            kind: edge.kind,
            declaration,
            sourceNodeIds,
            hostUnitIds: edge.hostUnitIds,
            targetNodeId,
            targetUnitId: edge.targetUnitId,
            unitIds: edge.unitIds,
            fingerprint: edge.fingerprint,
          });
        }
        for (const resolution of reference.reviewResolutions ?? []) {
          const review = requireReview(claim.inventory, resolution.reviewId);
          const sourceNodeIds = graphSourceNodes(
            nodes,
            boundaryId,
            claimPopulation,
            review.hostId,
            requireHost(claim.inventory.hosts, review.hostId).unitIds,
            root,
          );
          const targetNodeIds = resolution.resolution.units.map((unit) => {
            ensureUnitNode(
              nodes,
              boundaryId,
              "reference",
              referencePopulation,
              unit.id,
              root,
            );
            return graphUnitNodeId(boundaryId, "reference", unit.id);
          });
          reviews.push({
            id: `${boundaryId}:review:${review.id}`,
            boundaryId,
            reviews: review.reviews,
            review,
            status: resolution.resolution.status,
            sourceNodeIds,
            targetNodeIds,
          });
        }
      });
    });
    return {
      schemaVersion: 1,
      command: "graph",
      configFile: analysis.report.configFile,
      status: analysis.report.status,
      success: analysis.report.success,
      exitCode: analysis.report.exitCode,
      boundaries,
      nodes: Array.from(nodes.values()).sort((left, right) =>
        compare(left.id, right.id),
      ),
      edges: edges.sort((left, right) => compare(left.id, right.id)),
      reviews: reviews.sort((left, right) => compare(left.id, right.id)),
      diagnostics: analysis.report.diagnostics,
    };
  }

  /** Reports only adapters certified and shipped by the runtime registry. */
  export function languages(): IEvidenceLanguagesReport {
    const languages = EvidenceLanguageRegistry.list()
      .flatMap((language) =>
        language.adapter === undefined
          ? []
          : [
              {
                type: language.type,
                name: language.name,
                grammars: language.grammars,
                adapter: language.adapter,
              },
            ],
      )
      .sort((left, right) => compare(left.type, right.type));
    return {
      schemaVersion: 1,
      command: "languages",
      total: languages.length,
      languages,
    };
  }
}

function populations(
  analysis: IEvidenceCheckAnalysis,
): IEvidenceQueryPopulation[] {
  const output: IEvidenceQueryPopulation[] = [];
  analysis.graphInput.claims.forEach((claim, claimPosition) => {
    const reportClaim = requireReportClaim(analysis, claimPosition);
    output.push({
      scope: {
        role: "claim",
        claim: reportClaim.claim,
        ...(reportClaim.name === undefined ? {} : { name: reportClaim.name }),
        type: reportClaim.type,
      },
      inventory: claim.inventory,
      unitIds: claim.unitIds,
    });
    claim.references.forEach((reference, referencePosition) => {
      const reportObligation = requireReportObligation(
        analysis,
        claimPosition,
        referencePosition,
      );
      output.push({
        scope: {
          role: "reference",
          claim: reportClaim.claim,
          reference: reportObligation.reference,
          type: reportObligation.type,
        },
        inventory: reference.inventory,
        unitIds: reference.unitIds,
        reference,
        obligation: requireResultObligation(
          analysis,
          claimPosition,
          referencePosition,
        ),
      });
    });
  });
  return output;
}

function listPopulation(
  population: IEvidenceQueryPopulation,
  cwd: string,
): IEvidenceListItem[] {
  const visible = visibleUnits(population);
  return population.inventory.units.flatMap((unit) => {
    if (!visible.has(unit.id)) return [];
    const item = listItem(population, unit, cwd);
    return item === undefined ? [] : [item];
  });
}

function listItem(
  population: IEvidenceQueryPopulation,
  unit: IEvidenceUnit,
  cwd: string,
): IEvidenceListItem | undefined {
  const aliases = targets(population, unit.id, cwd);
  const target = aliases[0];
  if (target === undefined) return undefined;
  return {
    id: `${scopeId(population.scope)}:unit:${unit.id}`,
    scope: population.scope,
    unitId: unit.id,
    symbol: unit.symbol,
    name: unit.name,
    selection: selection(population, unit.id),
    target,
    aliases,
    locations: unit.sites.map((site) => ({
      file: site.file,
      range: site.range,
    })),
  };
}

async function inspectPopulation(
  analysis: IEvidenceCheckAnalysis,
  population: IEvidenceQueryPopulation,
  cwd: string,
  target: string,
): Promise<IEvidenceInspection> {
  const host = commandHost(cwd);
  const statement: IEvidenceTargetStatement = {
    target,
    hostId: host.id,
    location: { file: host.file, range: host.range },
  };
  const resolution = await new EvidenceTargetResolver(
    [population.inventory],
    population.scope.type,
  ).resolve(statement, host, population.unitIds);
  const units = resolution.units.map((unit) =>
    inspectedUnit(population, unit, cwd),
  );
  const unitIds = new Set(units.map((unit) => unit.item.unitId));
  return {
    scope: population.scope,
    status: resolution.status,
    addresses: InventoryMerge.unique(
      resolution.addresses.flatMap((address) =>
        formatAddress(population, address.file, address.segments, cwd),
      ),
      (address) => address,
    ).sort(compare),
    units,
    withdrawals: resolution.withdrawals,
    obligations: inspectedObligations(population, unitIds),
    acknowledgements: inspectedAcknowledgements(analysis, population, unitIds),
    reviews: inspectedReviews(analysis, population, unitIds),
    diagnostics: resolution.diagnostics.map((diagnostic) =>
      scopedDiagnostic(diagnostic, population.scope),
    ),
  };
}

function inspectedUnit(
  population: IEvidenceQueryPopulation,
  unit: IEvidenceUnit,
  cwd: string,
): IEvidenceInspectedUnit {
  const item = listItem(population, unit, cwd);
  if (item === undefined)
    throw new Error(`Evidence identity '${unit.id}' has no public address.`);
  const children = population.inventory.units.flatMap((candidate) => {
    if (candidate.parentId !== unit.id) return [];
    const child = listItem(population, candidate, cwd);
    return child === undefined ? [] : [child];
  });
  return {
    item,
    children,
    hosts: population.inventory.hosts
      .filter((host) => host.unitIds.includes(unit.id))
      .sort((left, right) => compare(left.id, right.id)),
    ...(population.inventory.complete
      ? {
          fingerprint: EvidenceFingerprint.inspect(
            population.inventory,
            unit.id,
          ),
        }
      : {}),
  };
}

function inspectedObligations(
  population: IEvidenceQueryPopulation,
  unitIds: Set<string>,
): IEvidenceInspectedObligation[] {
  if (population.scope.role !== "reference") return [];
  const obligation = population.obligation;
  const reference = population.scope.reference;
  if (obligation === undefined || reference === undefined) return [];
  return Array.from(unitIds).flatMap((unitId) => {
    const unit = population.inventory.units.find(
      (candidate) => candidate.id === unitId,
    );
    if (unit === undefined) return [];
    const state = selection(population, unitId);
    if (state === "unselected") return [];
    return [
      {
        claim: population.scope.claim,
        reference,
        policy: graphPolicy(requirePopulationReference(population)),
        active: obligation.active,
        complete: obligation.complete,
        selection: state,
        covered: covered(population, unitId),
        missing: missing(population, unitId),
      },
    ];
  });
}

function inspectedAcknowledgements(
  analysis: IEvidenceCheckAnalysis,
  population: IEvidenceQueryPopulation,
  unitIds: Set<string>,
): IEvidenceInspectedAcknowledgement[] {
  if (
    population.scope.role !== "reference" ||
    population.scope.reference === undefined
  )
    return [];
  return analysis.graph.claims.flatMap((claim, claimPosition) => {
    if (claim.claim !== population.scope.claim) return [];
    const input = analysis.graphInput.claims[claimPosition];
    if (input === undefined) return [];
    return claim.obligations.flatMap((obligation) => {
      if (obligation.reference !== population.scope.reference) return [];
      return obligation.edges.flatMap((edge) => {
        if (
          !unitIds.has(edge.targetUnitId) &&
          !edge.unitIds.some((unitId) => unitIds.has(unitId))
        )
          return [];
        const declaration = input.inventory.declarations.find(
          (candidate) => candidate.id === edge.declarationId,
        );
        if (declaration === undefined) return [];
        const host = input.inventory.hosts.find(
          (candidate) => candidate.id === declaration.hostId,
        );
        if (host === undefined) return [];
        return [
          {
            claim: obligation.claim,
            reference: obligation.reference,
            declaration,
            host,
            hostUnitIds: edge.hostUnitIds,
            targetUnitId: edge.targetUnitId,
            unitIds: edge.unitIds,
            fingerprint: edge.fingerprint,
          },
        ];
      });
    });
  });
}

function inspectedReviews(
  analysis: IEvidenceCheckAnalysis,
  population: IEvidenceQueryPopulation,
  unitIds: Set<string>,
): IEvidenceInspectedReview[] {
  if (
    population.scope.role !== "reference" ||
    population.scope.reference === undefined
  )
    return [];
  return analysis.graphInput.claims.flatMap((claim, claimPosition) =>
    claim.references.flatMap((reference, referencePosition) => {
      const reportClaim = requireReportClaim(analysis, claimPosition);
      const reportReference = requireReportObligation(
        analysis,
        claimPosition,
        referencePosition,
      );
      if (
        reportClaim.claim !== population.scope.claim ||
        reportReference.reference !== population.scope.reference
      )
        return [];
      const units = new Map(
        reference.inventory.units.map((unit) => [unit.id, unit]),
      );
      return (reference.reviewResolutions ?? []).flatMap((entry) => {
        if (
          !entry.resolution.units.some((target) =>
            Array.from(unitIds).some((unitId) =>
              descends(unitId, target.id, units),
            ),
          )
        )
          return [];
        const review = claim.inventory.reviews.find(
          (candidate) => candidate.id === entry.reviewId,
        );
        if (review === undefined) return [];
        const host = claim.inventory.hosts.find(
          (candidate) => candidate.id === review.hostId,
        );
        if (host === undefined) return [];
        return [
          {
            claim: reportClaim.claim,
            reference: reportReference.reference,
            review,
            host,
            status: entry.resolution.status,
            unitIds: entry.resolution.units.map((unit) => unit.id),
          },
        ];
      });
    }),
  );
}

function applicablePopulations(
  populations: IEvidenceQueryPopulation[],
  target: string,
): IEvidenceQueryPopulation[] {
  if (target.startsWith("prisma:"))
    return populations.filter(
      (population) => population.scope.type === "prisma",
    );
  if (swaggerLike(target))
    return populations.filter(
      (population) => population.scope.type === "swagger",
    );
  const file = targetFile(target);
  const types = new Set<EvidenceArtifactType>();
  if (/\.(?:md|markdown|mdx)$/iu.test(file)) types.add("markdown");
  for (const language of EvidenceLanguageRegistry.list())
    try {
      EvidenceLanguageRegistry.select(language.type, file);
      types.add(language.type);
    } catch {
      continue;
    }
  const selected = populations.filter((population) =>
    types.has(population.scope.type),
  );
  return selected.length === 0 ? populations : selected;
}

function visibleUnits(population: IEvidenceQueryPopulation): Set<string> {
  const units = new Map(
    population.inventory.units.map((unit) => [unit.id, unit]),
  );
  const visible = new Set<string>();
  for (const id of configuredUnits(population)) {
    const unit = units.get(id);
    if (unit !== undefined && !withdrawn(unit, units)) visible.add(id);
  }
  return visible;
}

function configuredUnits(population: IEvidenceQueryPopulation): Set<string> {
  const units = new Map(
    population.inventory.units.map((unit) => [unit.id, unit]),
  );
  const configured = new Set<string>();
  for (const id of population.unitIds) {
    let current = units.get(id);
    const visited = new Set<string>();
    while (current !== undefined && !visited.has(current.id)) {
      configured.add(current.id);
      visited.add(current.id);
      current =
        current.parentId === undefined
          ? undefined
          : units.get(current.parentId);
    }
  }
  return configured;
}

function withdrawn(
  input: IEvidenceUnit,
  units: Map<string, IEvidenceUnit>,
): boolean {
  const visited = new Set<string>();
  let unit: IEvidenceUnit | undefined = input;
  while (unit !== undefined && !visited.has(unit.id)) {
    if (unit.withdrawals.length !== 0) return true;
    visited.add(unit.id);
    unit = unit.parentId === undefined ? undefined : units.get(unit.parentId);
  }
  return false;
}

function selection(
  population: IEvidenceQueryPopulation,
  unitId: string,
): EvidenceUnitSelection {
  if (population.unitIds.includes(unitId)) return "selected";
  return visibleUnits(population).has(unitId) ? "ancestor" : "unselected";
}

function targets(
  population: IEvidenceQueryPopulation,
  unitId: string,
  cwd: string,
): string[] {
  return InventoryMerge.unique(
    population.inventory.addresses
      .filter((address) => address.unitId === unitId)
      .flatMap((address) =>
        formatAddress(population, address.file, address.segments, cwd),
      ),
    (target) => target,
  ).sort(compare);
}

function populationHasTarget(
  population: IEvidenceQueryPopulation,
  target: string,
  cwd: string,
): boolean {
  const configured = configuredUnits(population);
  return population.inventory.addresses.some(
    (address) =>
      configured.has(address.unitId) &&
      formatAddress(population, address.file, address.segments, cwd).includes(
        target,
      ),
  );
}

function formatAddress(
  population: IEvidenceQueryPopulation,
  file: string,
  segments: string[],
  cwd: string,
): string[] {
  if (population.scope.type === "prisma")
    return [`prisma:${segments.join(".")}`];
  if (population.scope.type === "swagger")
    return segments.length === 1 && segments[0] !== undefined
      ? [segments[0]]
      : [];
  if (population.scope.type === "markdown") {
    const logical = population.inventory.sources.flatMap((source) =>
      source.addresses.flatMap((address) =>
        address.selected !== false &&
        EvidenceFileTarget.normalize(address.absolute) ===
          EvidenceFileTarget.normalize(file)
          ? [address.relative]
          : [],
      ),
    );
    const files = logical.length === 0 ? [file] : logical;
    return files.map((candidate) =>
      segments.length === 0
        ? MarkdownTarget.normalize(candidate)
        : `${MarkdownTarget.normalize(candidate)}#${segments.join("#")}`,
    );
  }
  return [
    EvidenceFileTarget.format({
      file: path.relative(cwd, file),
      segments,
    }),
  ];
}

function commandHost(cwd: string): IEvidenceHost {
  const file = path.join(cwd, ".evidence-inspect");
  return {
    id: "evidence:inspect:host",
    file,
    origins: [file],
    range: zeroLocation(file).range,
    unitIds: [],
    attachment: "attached",
  };
}

function zeroLocation(file: string): Required<IEvidenceSourceLocation> {
  return {
    file,
    range: {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 0 },
    },
  };
}

function graphUnitNode(
  boundaryId: string,
  role: "claim" | "reference",
  item: IEvidenceListItem,
  isCovered: boolean,
  isMissing: boolean,
): IEvidenceGraphNode {
  return {
    id: graphUnitNodeId(boundaryId, role, item.unitId),
    boundaryId,
    role,
    unitId: item.unitId,
    symbol: item.symbol,
    name: item.name,
    target: item.target,
    selection: item.selection,
    covered: isCovered,
    missing: isMissing,
    locations: item.locations,
  };
}

function graphSourceNodes(
  nodes: Map<string, EvidenceGraphNode>,
  boundaryId: string,
  population: IEvidenceQueryPopulation,
  hostId: string,
  unitIds: string[],
  cwd: string,
): string[] {
  if (unitIds.length !== 0) {
    for (const unitId of unitIds)
      ensureUnitNode(nodes, boundaryId, "claim", population, unitId, cwd);
    return unitIds.map((unitId) =>
      graphUnitNodeId(boundaryId, "claim", unitId),
    );
  }
  const host = requireHost(population.inventory.hosts, hostId);
  const id = `${boundaryId}:host:${host.id}`;
  const node: IEvidenceGraphHostNode = {
    id,
    boundaryId,
    role: "host",
    hostId: host.id,
    name: host.id,
    location: { file: host.file, range: host.range },
  };
  nodes.set(id, node);
  return [id];
}

function ensureUnitNode(
  nodes: Map<string, EvidenceGraphNode>,
  boundaryId: string,
  role: "claim" | "reference",
  population: IEvidenceQueryPopulation,
  unitId: string,
  cwd: string,
): void {
  const id = graphUnitNodeId(boundaryId, role, unitId);
  if (nodes.has(id)) return;
  const unit = population.inventory.units.find(
    (candidate) => candidate.id === unitId,
  );
  if (unit === undefined)
    throw new Error(`Graph identity '${unitId}' is absent from its inventory.`);
  const item = listItem(population, unit, cwd);
  if (item === undefined)
    throw new Error(`Graph identity '${unitId}' has no public address.`);
  nodes.set(id, graphUnitNode(boundaryId, role, item, false, false));
}

function covered(
  population: IEvidenceQueryPopulation,
  unitId: string,
): boolean {
  const obligation = population.obligation;
  if (obligation === undefined) return false;
  if (obligation.coveredUnitIds.includes(unitId)) return true;
  if (selection(population, unitId) !== "ancestor") return false;
  const descendants = selectedDescendants(population, unitId);
  return (
    descendants.length !== 0 &&
    descendants.every((id) => obligation.coveredUnitIds.includes(id))
  );
}

function missing(
  population: IEvidenceQueryPopulation,
  unitId: string,
): boolean {
  const obligation = population.obligation;
  if (obligation === undefined) return false;
  if (obligation.missingUnitIds.includes(unitId)) return true;
  return selectedDescendants(population, unitId).some((id) =>
    obligation.missingUnitIds.includes(id),
  );
}

function selectedDescendants(
  population: IEvidenceQueryPopulation,
  ancestorId: string,
): string[] {
  const units = new Map(
    population.inventory.units.map((unit) => [unit.id, unit]),
  );
  return population.unitIds.filter((unitId) =>
    descends(unitId, ancestorId, units),
  );
}

function descends(
  unitId: string,
  ancestorId: string,
  units: Map<string, IEvidenceUnit>,
): boolean {
  const visited = new Set<string>();
  let unit = units.get(unitId);
  while (unit !== undefined && !visited.has(unit.id)) {
    if (unit.id === ancestorId) return true;
    visited.add(unit.id);
    unit = unit.parentId === undefined ? undefined : units.get(unit.parentId);
  }
  return false;
}

function requirePopulation(
  entries: IEvidenceQueryPopulation[],
  role: "claim" | "reference",
  claim: number,
  reference?: number,
): IEvidenceQueryPopulation {
  const population = entries.find(
    (entry) =>
      entry.scope.role === role &&
      entry.scope.claim === claim &&
      entry.scope.reference === reference,
  );
  if (population === undefined)
    throw new Error(
      `Missing query population '${role}:${claim}:${reference ?? -1}'.`,
    );
  return population;
}

function requirePopulationReference(
  population: IEvidenceQueryPopulation,
): IEvidenceGraphReference {
  if (population.reference === undefined)
    throw new Error("A reference query population has no graph input.");
  return population.reference;
}

function graphPolicy(reference: IEvidenceGraphReference): IEvidenceGraphPolicy {
  return {
    severity: reference.severity,
    noEvidenceExclude: reference.noEvidenceExclude === true,
    uniqueEvidence: reference.uniqueEvidence === true,
    singleEvidencePerSymbol: reference.singleEvidencePerSymbol === true,
    checklist: reference.checklist === true,
    requireReview: reference.requireReview === true,
  };
}

function requireReportClaim(
  analysis: IEvidenceCheckAnalysis,
  position: number,
): IEvidenceCheckAnalysis["report"]["claims"][number] {
  const claim = analysis.report.claims[position];
  if (claim === undefined)
    throw new Error(`Missing report claim at position ${position}.`);
  return claim;
}

function requireResultClaim(
  analysis: IEvidenceCheckAnalysis,
  position: number,
): IEvidenceCheckAnalysis["graph"]["claims"][number] {
  const claim = analysis.graph.claims[position];
  if (claim === undefined)
    throw new Error(`Missing graph claim at position ${position}.`);
  return claim;
}

function requireReportObligation(
  analysis: IEvidenceCheckAnalysis,
  claim: number,
  reference: number,
): IEvidenceCheckAnalysis["report"]["claims"][number]["obligations"][number] {
  const obligation = requireReportClaim(analysis, claim).obligations[reference];
  if (obligation === undefined)
    throw new Error(
      `Missing report obligation at position ${claim}:${reference}.`,
    );
  return obligation;
}

function requireResultObligation(
  analysis: IEvidenceCheckAnalysis,
  claim: number,
  reference: number,
): IEvidenceCheckAnalysis["graph"]["claims"][number]["obligations"][number] {
  const obligation = requireResultClaim(analysis, claim).obligations[reference];
  if (obligation === undefined)
    throw new Error(
      `Missing graph obligation at position ${claim}:${reference}.`,
    );
  return obligation;
}

function requireDeclaration(
  inventory: IEvidenceQueryPopulation["inventory"],
  id: string,
): IEvidenceDeclaration {
  const declaration = inventory.declarations.find(
    (candidate) => candidate.id === id,
  );
  if (declaration === undefined)
    throw new Error(`Missing graph acknowledgement '${id}'.`);
  return declaration;
}

function requireReview(
  inventory: IEvidenceQueryPopulation["inventory"],
  id: string,
): IEvidenceReview {
  const review = inventory.reviews.find((candidate) => candidate.id === id);
  if (review === undefined) throw new Error(`Missing graph review '${id}'.`);
  return review;
}

function requireHost(hosts: IEvidenceHost[], id: string): IEvidenceHost {
  const host = hosts.find((candidate) => candidate.id === id);
  if (host === undefined) throw new Error(`Missing graph host '${id}'.`);
  return host;
}

function scopedDiagnostic(
  diagnostic: IEvidenceDiagnostic,
  scope: IEvidenceQueryScope,
): IEvidenceDiagnostic {
  return {
    ...diagnostic,
    claim: scope.claim,
    ...(scope.reference === undefined ? {} : { reference: scope.reference }),
  };
}

function uniqueDiagnostics(
  diagnostics: IEvidenceDiagnostic[],
): IEvidenceDiagnostic[] {
  return InventoryMerge.unique(diagnostics, (diagnostic) =>
    JSON.stringify(diagnostic),
  );
}

function scopeId(scope: IEvidenceQueryScope): string {
  return scope.reference === undefined
    ? `claim:${scope.claim}`
    : `claim:${scope.claim}:reference:${scope.reference}`;
}

function boundary(claim: number, reference: number): string {
  return `claim:${claim}:reference:${reference}`;
}

function graphUnitNodeId(
  boundaryId: string,
  role: "claim" | "reference",
  unitId: string,
): string {
  return `${boundaryId}:${role}:${unitId}`;
}

function targetFile(target: string): string {
  const separator = target.indexOf("#");
  const encoded = separator < 0 ? target : target.slice(0, separator);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function swaggerLike(target: string): boolean {
  const match = /^([^:\s/]+):\//u.exec(target);
  const method = match?.[1];
  return (
    (method !== undefined && !/^[A-Za-z]$/u.test(method)) ||
    /^(?:GET|PUT|POST|DELETE|OPTIONS|HEAD|PATCH|TRACE)(?::|\s)/iu.test(target)
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
