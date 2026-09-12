import typia from "typia";

import { InventoryMerge } from "./internal/InventoryMerge";
import { SourceText } from "./internal/SourceText";
import type { IEvidenceAddress } from "./structures/IEvidenceAddress";
import type { IEvidenceDiagnostic } from "./structures/IEvidenceDiagnostic";
import type { IEvidenceInventory } from "./structures/IEvidenceInventory";
import type { IEvidencePopulation } from "./structures/IEvidencePopulation";
import type { IEvidenceResolution } from "./structures/IEvidenceResolution";
import type { IEvidenceSourceLocation } from "./structures/IEvidenceSourceLocation";
import type { IEvidenceUnit } from "./structures/IEvidenceUnit";
import type { IEvidenceUnitSite } from "./structures/IEvidenceUnitSite";
import type { IEvidenceWithdrawal } from "./structures/IEvidenceWithdrawal";

/** Merges language-neutral adapter output and projects independent graph populations. */
export class EvidenceInventory {
  private readonly data: IEvidenceInventory;
  private readonly units = new Map<string, IEvidenceUnit>();
  private readonly withdrawals = new Map<string, IEvidenceWithdrawal[]>();

  public constructor(inventories: IEvidenceInventory[]) {
    this.data = InventoryMerge.combine(
      structuredClone(typia.assert(inventories)),
    );
    for (const unit of this.data.units) this.units.set(unit.id, unit);
    this.validate();
    this.normalize();
  }

  /** Returns an independent serializable snapshot; mutations cannot alter this index. */
  public snapshot(): IEvidenceInventory {
    return structuredClone(this.data);
  }

  /** Stable schema-order JSON with deterministic array order. */
  public serialize(): string {
    return typia.json.stringify(this.data);
  }

  /** Selects explicit identities, includes real ancestors, and reconciles merged withdrawal. */
  public select(ids: string[]): IEvidencePopulation {
    const requested = new Set(ids);
    const scopes = new Set<string>();
    for (const id of requested) {
      if (!this.units.has(id))
        throw new Error(`Unknown selected semantic identity: ${id}`);
      for (const ancestor of this.ancestors(id)) scopes.add(ancestor.id);
    }
    const visible = this.data.units.filter(
      (unit) => requested.has(unit.id) && !this.hidden(unit.id),
    );
    const selected = new Set(visible.map((unit) => unit.id));
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

  /** Resolves only an exact file/segment address within the requested population's scopes. */
  public resolve(
    address: IEvidenceAddress,
    ids: string[],
  ): IEvidenceResolution {
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
      withdrawals: InventoryMerge.unique(
        withdrawn.flatMap((unit) => this.withdrawals.get(unit.id) ?? []),
        (value) => typia.json.stringify(value),
      ),
    });
  }

  private hidden(id: string): boolean {
    return (this.withdrawals.get(id)?.length ?? 0) !== 0;
  }

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

  private validate(): void {
    const sources = new Map<string, SourceText>();
    for (const source of this.data.sources) {
      const text = new SourceText(source.content);
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
          (InventoryMerge.siteKey(ownPrevious) !==
            InventoryMerge.siteKey(site) ||
            InventoryMerge.contentKey(ownPrevious) !==
              InventoryMerge.contentKey(site))
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
          InventoryMerge.siteKey(previous) !== InventoryMerge.siteKey(site)
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
    const hosts = new Map(this.data.hosts.map((host) => [host.id, host]));
    for (const host of this.data.hosts) {
      this.checkLocation(host, sources);
      if (host.attachment === "attached") {
        if (host.unitIds.length === 0)
          this.problem(
            "inventory-host",
            `Attached host ${host.id} has no semantic owner.`,
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

  private checkLocation(
    location: IEvidenceSourceLocation,
    sources: Map<string, SourceText>,
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

  private normalize(): void {
    this.data.sources = InventoryMerge.unique(
      this.data.sources,
      (source) => source.id,
    );
    for (const source of this.data.sources)
      source.addresses = InventoryMerge.sourceAddresses(source.addresses);
    this.data.annotationRanges = InventoryMerge.unique(
      this.data.annotationRanges,
      (location) => typia.json.stringify(location),
    );
    this.data.units = InventoryMerge.unique(this.data.units, (unit) => unit.id);
    for (const unit of this.data.units) {
      unit.sites = InventoryMerge.unique(unit.sites, (site) => site.id);
      for (const site of unit.sites)
        site.content = InventoryMerge.unique(site.content, (range) =>
          JSON.stringify([range.start.offset, range.end.offset]),
        ).sort((x, y) => {
          const start = x.start.offset - y.start.offset;
          return start !== 0 ? start : x.end.offset - y.end.offset;
        });
      unit.withdrawals = InventoryMerge.unique(unit.withdrawals, (withdrawal) =>
        typia.json.stringify(withdrawal),
      );
    }
    this.data.addresses = InventoryMerge.unique(
      this.data.addresses,
      (address) =>
        JSON.stringify([address.file, address.segments, address.unitId]),
    );
    this.data.hosts = InventoryMerge.unique(this.data.hosts, (host) => host.id);
    for (const host of this.data.hosts) {
      host.unitIds = InventoryMerge.unique(host.unitIds, (id) => id);
      host.origins = InventoryMerge.unique(
        host.origins ?? [host.file],
        (file) => file,
      );
      if (host.origins.length === 0)
        this.problem(
          "inventory-host",
          `Host ${host.id} has no citation origin.`,
          host,
        );
    }
    this.data.declarations = InventoryMerge.unique(
      this.data.declarations,
      (entry) => entry.id,
    );
    this.data.reviews = InventoryMerge.unique(
      this.data.reviews,
      (entry) => entry.id,
    );
    this.data.dependencies = InventoryMerge.unique(
      this.data.dependencies,
      (dependency) => JSON.stringify([dependency.path, dependency.recursive]),
    );
    this.data.diagnostics = InventoryMerge.unique(
      this.data.diagnostics,
      (diagnostic: IEvidenceDiagnostic) => typia.json.stringify(diagnostic),
    );
  }
}
