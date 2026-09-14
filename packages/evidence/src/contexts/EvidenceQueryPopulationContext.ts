import type { IEvidenceQueryPopulation } from "../internal/IEvidenceQueryPopulation";
import type { IEvidencePublicAddress } from "../structures/IEvidencePublicAddress";
import type { IEvidenceUnit } from "../structures/IEvidenceUnit";

/** Indexes one claim or reference population within an owned query snapshot. */
export class EvidenceQueryPopulationContext {
  /** Claim or reference coordinates that distinguish this population's obligation. */
  public readonly scope: IEvidenceQueryPopulation["scope"];

  /** Inventory owned by the containing query snapshot. */
  public readonly inventory: IEvidenceQueryPopulation["inventory"];

  /** Configured selection in its original order. */
  public readonly unitIds: IEvidenceQueryPopulation["unitIds"];

  /** Coverage policy when this population represents a reference. */
  public readonly reference: IEvidenceQueryPopulation["reference"];

  /** Evaluated coverage when this population represents a reference. */
  public readonly obligation: IEvidenceQueryPopulation["obligation"];

  /** Semantic units indexed once for parent and descendant traversal. */
  public readonly units: Map<string, IEvidenceUnit>;

  /** Explicitly selected identities, excluding structural ancestors added for lookup. */
  public readonly selected: Set<string>;

  /** Selected identities and their existing structural ancestors. */
  public readonly configured = new Set<string>();

  /** Configured identities that have no withdrawn ancestor or own withdrawal. */
  public readonly visible = new Set<string>();

  /** Public aliases grouped by semantic identity in inventory order. */
  public readonly addresses = new Map<string, IEvidencePublicAddress[]>();

  /** Selected descendant results cached separately for each queried ancestor. */
  private readonly descendants = new Map<string, string[]>();

  /** Builds indexes from a population belonging to an already owned analysis snapshot. */
  public constructor(population: IEvidenceQueryPopulation) {
    this.scope = population.scope;
    this.inventory = population.inventory;
    this.unitIds = population.unitIds;
    this.reference = population.reference;
    this.obligation = population.obligation;
    this.units = new Map(this.inventory.units.map((unit) => [unit.id, unit]));
    this.selected = new Set(this.unitIds);

    for (const id of this.unitIds) {
      let current = this.units.get(id);
      const visited = new Set<string>();
      while (current !== undefined && !visited.has(current.id)) {
        this.configured.add(current.id);
        visited.add(current.id);
        current =
          current.parentId === undefined
            ? undefined
            : this.units.get(current.parentId);
      }
    }
    for (const id of this.configured) {
      let current = this.units.get(id);
      const visited = new Set<string>();
      let withdrawn = false;
      while (current !== undefined && !visited.has(current.id)) {
        if (current.withdrawals.length !== 0) {
          withdrawn = true;
          break;
        }
        visited.add(current.id);
        current =
          current.parentId === undefined
            ? undefined
            : this.units.get(current.parentId);
      }
      if (!withdrawn) this.visible.add(id);
    }
    for (const address of this.inventory.addresses) {
      const entries = this.addresses.get(address.unitId) ?? [];
      entries.push(address);
      this.addresses.set(address.unitId, entries);
    }
  }

  /** Returns selected descendants in configured order, including the ancestor if selected. */
  public selectedDescendants(ancestorId: string): readonly string[] {
    const remembered = this.descendants.get(ancestorId);
    if (remembered !== undefined) return remembered;
    const descendants = this.unitIds.filter((unitId) =>
      this.descends(unitId, ancestorId),
    );
    this.descendants.set(ancestorId, descendants);
    return descendants;
  }

  /** Tests structural ancestry, including the identity itself, without revisiting parent cycles. */
  public descends(unitId: string, ancestorId: string): boolean {
    const visited = new Set<string>();
    let unit = this.units.get(unitId);
    while (unit !== undefined && !visited.has(unit.id)) {
      if (unit.id === ancestorId) return true;
      visited.add(unit.id);
      unit =
        unit.parentId === undefined ? undefined : this.units.get(unit.parentId);
    }
    return false;
  }
}
