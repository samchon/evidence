import typia from "typia";

import { EvidenceInventoryMerge } from "../internal/EvidenceInventoryMerge";
import { EvidenceSourceText } from "../internal/EvidenceSourceText";
import type { IEvidenceAddress } from "../structures/IEvidenceAddress";
import type { IEvidenceDiagnostic } from "../structures/IEvidenceDiagnostic";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidencePopulation } from "../structures/IEvidencePopulation";
import type { IEvidenceResolution } from "../structures/IEvidenceResolution";
import type { IEvidenceSourceLocation } from "../structures/IEvidenceSourceLocation";
import type { IEvidenceUnit } from "../structures/IEvidenceUnit";
import type { IEvidenceUnitSite } from "../structures/IEvidenceUnitSite";
import type { IEvidenceWithdrawal } from "../structures/IEvidenceWithdrawal";

/**
 * Reconciles adapter records and indexes independently selected evidence
 * populations.
 *
 * Construction captures the supplied inventories, merges compatible identities,
 * and checks source ranges, parent relationships, addresses, and host
 * ownership. Inconsistent records leave diagnostics and an incomplete inventory
 * instead of silently disappearing from the denominator. Normalization makes
 * snapshots and serialization deterministic.
 *
 * Selection distinguishes required units from their addressable ancestors and
 * propagates withdrawals through explicit parent links. Resolution then matches
 * an exact file and segmented accessor within that scope. Aliases can name one
 * identity; an address naming several identities remains ambiguous.
 *
 * Snapshots, populations, and resolutions are owned copies. Mutating one result
 * cannot affect this index or a later selection.
 *
 * @example
 *   const inventory: EvidenceInventory = new EvidenceInventory([adapterOutput]);
 *   const population: IEvidencePopulation = inventory.select([methodId]);
 *   const target: IEvidenceResolution = inventory.resolve(
 *     { file: "api.ts", segments: ["Client"] },
 *     [methodId],
 *   );
 *   // Client may resolve as an aggregate owner while only its method is required.
 */
export class EvidenceInventory {
  /**
   * Reconciled records owned by this index.
   *
   * Validation appends findings here before normalization. Public methods
   * return copies so callers cannot invalidate the lookup tables by editing a
   * snapshot.
   */
  private readonly data: IEvidenceInventory;

  /**
   * Semantic identity lookup over the reconciled units.
   *
   * Parent traversal uses these IDs rather than public names. The same table
   * supports validation of addresses, hosts, and selected identities.
   */
  private readonly units = new Map<string, IEvidenceUnit>();

  /**
   * Effective withdrawals for each unit, including its ancestors' directives.
   *
   * Validation computes these chains once. Selection excludes affected units,
   * while resolution retains the directive locations to explain hidden
   * targets.
   */
  private readonly withdrawals = new Map<string, IEvidenceWithdrawal[]>();

  /**
   * Captures, reconciles, and validates one or more adapter inventories.
   *
   * Shape validation rejects malformed input. Semantic inconsistencies become
   * inventory diagnostics so callers can inspect the partial records and their
   * incomplete status rather than receiving an apparently healthy subset.
   */
  public constructor(inventories: IEvidenceInventory[]) {
    this.data = EvidenceInventoryMerge.combine(
      structuredClone(typia.assert(inventories)),
    );
    for (const unit of this.data.units) this.units.set(unit.id, unit);
    this.validate();
    this.normalize();
  }

  /**
   * Returns a serializable copy of the reconciled inventory.
   *
   * The copy includes diagnostics and incomplete records. Callers may inspect
   * or mutate it without changing future selections or resolutions on this
   * index.
   */
  public snapshot(): IEvidenceInventory {
    return structuredClone(this.data);
  }

  /**
   * Serializes the normalized inventory in stable schema order.
   *
   * Construction has already reconciled and sorted the collections. Serializing
   * therefore preserves deterministic output without changing selection state
   * or requiring callers to normalize a snapshot themselves.
   */
  public serialize(): string {
    return typia.json.stringify(this.data);
  }

  /**
   * Projects selected identities and the structural context needed to resolve
   * them.
   *
   * Required units exclude effective withdrawals, while scopes include their
   * real ancestors. Hosts are narrowed to selected semantic owners, including
   * hosts without tags. Unknown requested IDs throw because they indicate an
   * invalid selection, rather than an empty configured population.
   *
   * @example
   *   // Selecting a method retains its class as a resolvable aggregate scope.
   *   // The class does not become an extra required unit unless its ID is selected.
   */
  public select(ids: string[]): IEvidencePopulation {
    const requested = new Set(ids);
    const scopes = new Set<string>();
    // Keep the original closure for hidden-target explanations, even when a
    // requested unit is later removed by an inherited withdrawal.
    for (const id of requested) {
      if (!this.units.has(id))
        throw new Error(`Unknown selected semantic identity: ${id}`);
      for (const ancestor of this.ancestors(id)) scopes.add(ancestor.id);
    }
    const visible = this.data.units.filter(
      (unit) => requested.has(unit.id) && !this.hidden(unit.id),
    );
    const selected = new Set(visible.map((unit) => unit.id));
    // Only ancestors of surviving requirements remain visible scopes. An owner
    // of exclusively withdrawn units must not re-enter through aggregate lookup.
    const visibleScopes = new Set(
      visible.flatMap((unit) =>
        this.ancestors(unit.id).map((ancestor) => ancestor.id),
      ),
    );
    return structuredClone({
      units: visible,
      scopes: this.data.units.filter((unit) => visibleScopes.has(unit.id)),
      hidden: this.data.units.filter(
        (unit) => scopes.has(unit.id) && this.hidden(unit.id),
      ),
      hosts: this.data.hosts
        .filter(
          (host) =>
            host.attachment === "attached" &&
            host.unitIds.some((id) => selected.has(id)),
        )
        .map((host) => ({
          ...host,
          unitIds: host.unitIds.filter((id) => selected.has(id)),
        })),
      complete: this.data.complete,
      diagnostics: this.data.diagnostics,
    });
  }

  /**
   * Resolves an exact public address inside a selected population's structural
   * scope.
   *
   * Aliases resolving to one unit are deduplicated by identity; distinct
   * matching units remain ambiguous. A withdrawn match carries its withdrawal
   * locations. Incomplete inventory takes precedence over all apparent matches
   * because missing extraction may hide another candidate or invalidate the
   * population.
   */
  public resolve(address: IEvidenceAddress, ids: string[]): IEvidenceResolution {
    const population = this.select(ids);
    const visible = new Set(population.scopes.map((unit) => unit.id));
    const hidden = new Set(population.hidden.map((unit) => unit.id));
    const matching = new Set(
      this.data.addresses
        .filter(
          (candidate) =>
            candidate.file === address.file &&
            JSON.stringify(candidate.segments) ===
              JSON.stringify(address.segments),
        )
        .map((candidate) => candidate.unitId),
    );
    const found = this.data.units.filter(
      (unit) => matching.has(unit.id) && visible.has(unit.id),
    );
    const withdrawn = this.data.units.filter(
      (unit) => matching.has(unit.id) && hidden.has(unit.id),
    );
    // A partial inventory cannot prove uniqueness or absence. Preserve that
    // uncertainty before choosing resolved, ambiguous, hidden, or missing.
    return structuredClone({
      status: !this.data.complete
        ? "incomplete"
        : found.length > 1
          ? "ambiguous"
          : found.length === 1
            ? "resolved"
            : withdrawn.length > 0
              ? "hidden"
              : "missing",
      units: found.length === 0 ? withdrawn : found,
      withdrawals: EvidenceInventoryMerge.unique(
        withdrawn.flatMap((unit) => this.withdrawals.get(unit.id) ?? []),
        (value) => typia.json.stringify(value),
      ),
    });
  }

  /**
   * Tests whether a semantic identity is removed by its own or an inherited
   * withdrawal.
   *
   * The map is populated during validation from the explicit parent chain.
   * Consumers use this predicate after retaining structural closure, so a
   * hidden ancestor can still be named in a diagnostic without returning it as
   * a visible requirement.
   */
  private hidden(id: string): boolean {
    return (this.withdrawals.get(id)?.length ?? 0) !== 0;
  }

  /**
   * Returns an identity and its reachable structural ancestors in child-to-root
   * order.
   *
   * Selection uses this closure for aggregate addresses and inherited
   * withdrawals. The visited set bounds malformed parent cycles; validation
   * reports the cycle separately rather than letting a lookup or diagnostic
   * construction loop forever.
   */
  private ancestors(id: string): IEvidenceUnit[] {
    const output: IEvidenceUnit[] = [];
    const seen = new Set<string>();
    let current = this.units.get(id);
    while (current !== undefined && !seen.has(current.id)) {
      output.push(current);
      seen.add(current.id);
      current =
        current.parentId === undefined
          ? undefined
          : this.units.get(current.parentId);
    }
    return output;
  }

  /**
   * Checks that merged records still describe a coherent source and ownership
   * graph.
   *
   * Validation is deliberately non-throwing for semantic contradictions. Each
   * finding marks the inventory incomplete and remains available to graph
   * reporting, while malformed runtime input has already failed shape
   * validation at construction.
   */
  private validate(): void {
    const sources = new Map<string, EvidenceSourceText>();
    for (const source of this.data.sources) {
      const text = new EvidenceSourceText(source.content);
      for (const file of [
        source.physicalPath,
        ...source.addresses.map((address) => address.absolute),
      ]) {
        const previous = sources.get(file);
        if (previous !== undefined && previous.content !== source.content)
          this.problem(
            "inventory-source",
            "One source path names different source contents.",
            { file },
          );
        sources.set(file, text);
      }
    }
    // Source-coordinate checks run before cross-record ownership checks so every
    // later site, host, declaration, and review can use the same original text map.
    const sites = new Map<string, IEvidenceUnitSite>();
    for (const annotation of this.data.annotationRanges)
      this.checkLocation(annotation, sources);
    for (const unit of this.data.units) {
      if (unit.sites.length === 0)
        this.problem(
          "inventory-site",
          `Identity ${unit.id} has no declaration site.`,
        );
      const ownSites = new Map<string, IEvidenceUnitSite>();
      for (const site of unit.sites) {
        const ownPrevious = ownSites.get(site.id);
        if (
          ownPrevious !== undefined &&
          (EvidenceInventoryMerge.siteKey(ownPrevious) !==
            EvidenceInventoryMerge.siteKey(site) ||
            EvidenceInventoryMerge.contentKey(ownPrevious) !==
              EvidenceInventoryMerge.contentKey(site))
        )
          this.problem(
            "inventory-content",
            `Identity ${unit.id} assigns conflicting content to site ${site.id}.`,
            site,
          );
        ownSites.set(site.id, site);
        const previous = sites.get(site.id);
        if (
          previous !== undefined &&
          EvidenceInventoryMerge.siteKey(previous) !==
            EvidenceInventoryMerge.siteKey(site)
        )
          this.problem(
            "inventory-site",
            `Declaration site ${site.id} has conflicting locations.`,
            site,
          );
        sites.set(site.id, site);
        this.checkLocation(site, sources);
        for (const range of site.content) {
          this.checkLocation({ file: site.file, range }, sources);
          if (
            range.start.offset < site.range.start.offset ||
            range.end.offset > site.range.end.offset
          )
            this.problem(
              "inventory-content",
              `Content of ${unit.id} lies outside its declaration site.`,
              site,
            );
        }
      }
      if (unit.parentId !== undefined && !this.units.has(unit.parentId))
        this.problem(
          "inventory-parent",
          `Identity ${unit.id} names missing parent ${unit.parentId}.`,
        );
      const ancestors = this.ancestors(unit.id);
      const last = ancestors.at(-1);
      if (
        last !== undefined &&
        last.parentId !== undefined &&
        this.units.has(last.parentId)
      )
        this.problem(
          "inventory-cycle",
          `The parent chain of ${unit.id} contains a cycle.`,
        );
      // Cache inherited directives per identity. Applying only local withdrawals
      // would expose a child that an enclosing symbol explicitly withdrew.
      this.withdrawals.set(
        unit.id,
        ancestors.flatMap((ancestor) => ancestor.withdrawals),
      );
      for (const withdrawal of unit.withdrawals)
        this.checkLocation(withdrawal.location, sources);
    }
    for (const address of this.data.addresses)
      if (!this.units.has(address.unitId))
        this.problem(
          "inventory-address",
          `Public address names missing identity ${address.unitId}.`,
          { file: address.file },
        );
    // Annotation attachment is valid only when a host belongs to a declaration
    // site. A matching file name alone is insufficient for generated or repeated text.
    const hosts = new Map(this.data.hosts.map((host) => [host.id, host]));
    for (const host of this.data.hosts) {
      this.checkLocation(host, sources);
      if (host.attachment === "attached") {
        if (host.unitIds.length === 0 && host.siteId !== undefined)
          this.problem(
            "inventory-host",
            `Attached semantic host ${host.id} has no semantic owner.`,
            host,
          );
        if (host.unitIds.length !== 0 && host.siteId === undefined)
          this.problem(
            "inventory-host",
            `Attached semantic host ${host.id} has no declaration site.`,
            host,
          );
        for (const id of host.unitIds) {
          const unit = this.units.get(id);
          if (
            unit === undefined ||
            !unit.sites.some(
              (site) => site.id === host.siteId && site.file === host.file,
            )
          )
            this.problem(
              "inventory-host",
              `Host ${host.id} is not attached to a declaration owned by ${id}.`,
              host,
            );
        }
      } else if (host.unitIds.length !== 0 || host.siteId !== undefined)
        this.problem(
          "inventory-host",
          `Unattached or unsupported host ${host.id} claims a semantic owner.`,
          host,
        );
    }
    for (const entry of this.data.declarations) {
      this.checkLocation(entry.location, sources);
      const host = hosts.get(entry.hostId);
      const range = entry.location.range;
      if (
        host === undefined ||
        host.attachment !== "attached" ||
        range === undefined ||
        host.file !== entry.location.file ||
        range.start.offset < host.range.start.offset ||
        range.end.offset > host.range.end.offset
      )
        this.problem(
          "inventory-host",
          `Annotation ${entry.id} does not belong to an eligible documentation host.`,
          entry.location,
        );
    }
    for (const entry of this.data.reviews) {
      this.checkLocation(entry.location, sources);
      const host = hosts.get(entry.hostId);
      const range = entry.location.range;
      if (
        host === undefined ||
        host.attachment !== "attached" ||
        range === undefined ||
        host.file !== entry.location.file ||
        range.start.offset < host.range.start.offset ||
        range.end.offset > host.range.end.offset
      )
        this.problem(
          "inventory-host",
          `Review ${entry.id} does not belong to an eligible documentation host.`,
          entry.location,
        );
    }
  }

  /**
   * Verifies that an optional source range belongs to the recorded source
   * snapshot.
   *
   * Adapter records must point into the exact original content, not merely to a
   * path that happens to exist. Missing source text, absent ranges, and
   * out-of-bounds coordinates all make later diagnostics and fingerprints
   * unreliable.
   */
  private checkLocation(
    location: IEvidenceSourceLocation,
    sources: Map<string, EvidenceSourceText>,
  ): void {
    const text = sources.get(location.file);
    if (
      text === undefined ||
      location.range === undefined ||
      !text.contains(location.range)
    )
      this.problem(
        "inventory-location",
        "A declaration location does not match its original source snapshot.",
        location,
      );
  }

  /**
   * Appends one inventory diagnostic and permanently marks this snapshot
   * incomplete.
   *
   * This central path keeps all validation failures visible to the graph
   * evaluator. An optional location is reduced to the portable file/range form
   * accepted by the report schema, preserving a specific repair site when the
   * source record supplied one.
   */
  private problem(
    code: string,
    message: string,
    location?: IEvidenceSourceLocation,
  ): void {
    this.data.complete = false;
    this.data.diagnostics.push({
      code,
      severity: "error",
      message,
      repair:
        "Correct the adapter's source, identity, or ownership records before evaluating coverage.",
      ...(location === undefined
        ? {}
        : {
            location: {
              file: location.file,
              ...(location.range === undefined
                ? {}
                : { range: location.range }),
            },
          }),
    });
  }

  /**
   * Deduplicates and canonically orders merged records after validation.
   *
   * Normalization does not repair contradictions already reported. It only
   * gives snapshots, serialized output, and diagnostic ordering a stable
   * representation when equivalent adapter records arrived from independent
   * scan inputs.
   */
  private normalize(): void {
    this.data.sources = EvidenceInventoryMerge.unique(
      this.data.sources,
      (source) => source.id,
    );
    for (const source of this.data.sources)
      source.addresses = EvidenceInventoryMerge.sourceAddresses(source.addresses);
    this.data.annotationRanges = EvidenceInventoryMerge.unique(
      this.data.annotationRanges,
      (location) => typia.json.stringify(location),
    );
    this.data.units = EvidenceInventoryMerge.unique(
      this.data.units,
      (unit) => unit.id,
    );
    for (const unit of this.data.units) {
      unit.sites = EvidenceInventoryMerge.unique(unit.sites, (site) => site.id);
      for (const site of unit.sites)
        site.content = EvidenceInventoryMerge.unique(site.content, (range) =>
          JSON.stringify([range.start.offset, range.end.offset]),
        ).sort((x, y) => {
          const start = x.start.offset - y.start.offset;
          return start !== 0 ? start : x.end.offset - y.end.offset;
        });
      unit.withdrawals = EvidenceInventoryMerge.unique(
        unit.withdrawals,
        (withdrawal) => typia.json.stringify(withdrawal),
      );
    }
    this.data.addresses = EvidenceInventoryMerge.unique(
      this.data.addresses,
      (address) =>
        JSON.stringify([address.file, address.segments, address.unitId]),
    );
    this.data.hosts = EvidenceInventoryMerge.unique(
      this.data.hosts,
      (host) => host.id,
    );
    for (const host of this.data.hosts) {
      host.unitIds = EvidenceInventoryMerge.unique(host.unitIds, (id) => id);
      host.origins = EvidenceInventoryMerge.unique(
        host.origins ?? [host.file],
        (file) => file,
      );
      // Citation origin is required to explain generated or shared hosts. Keep the
      // host record for diagnostics instead of silently deleting an invalid entry.
      if (host.origins.length === 0)
        this.problem(
          "inventory-host",
          `Host ${host.id} has no citation origin.`,
          host,
        );
    }
    this.data.declarations = EvidenceInventoryMerge.unique(
      this.data.declarations,
      (entry) => entry.id,
    );
    this.data.reviews = EvidenceInventoryMerge.unique(
      this.data.reviews,
      (entry) => entry.id,
    );
    this.data.dependencies = EvidenceInventoryMerge.unique(
      this.data.dependencies,
      (dependency) => JSON.stringify([dependency.path, dependency.recursive]),
    );
    this.data.diagnostics = EvidenceInventoryMerge.unique(
      this.data.diagnostics,
      (diagnostic: IEvidenceDiagnostic) => typia.json.stringify(diagnostic),
    );
  }
}
