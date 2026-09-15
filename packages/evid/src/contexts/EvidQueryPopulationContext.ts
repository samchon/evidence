import type { IEvidQueryPopulation } from "../internal/IEvidQueryPopulation";
import type { IEvidPublicAddress } from "../structures/IEvidPublicAddress";
import type { IEvidUnit } from "../structures/IEvidUnit";

/**
 * Indexes one configured population for repeated structural and coverage queries.
 *
 * The containing facade owns the analysis snapshot. This context borrows its
 * records, distinguishes explicit selection from ancestor closure and visibility,
 * and caches descendant traversal without rebuilding indexes for each operation.
 */
export class EvidQueryPopulationContext {
  /**
   * Claim or reference coordinates identifying the configured population.
   *
   * Query rows qualify semantic identities with this scope to retain independent obligations.
   */
  public readonly scope: IEvidQueryPopulation["scope"];

  /**
   * Inventory borrowed from the containing facade's isolated analysis snapshot.
   *
   * It supplies full structural context, including units outside explicit selection.
   */
  public readonly inventory: IEvidQueryPopulation["inventory"];

  /**
   * Configured semantic selection in its original order.
   *
   * Descendant results preserve this order rather than adopting map traversal order.
   */
  public readonly unitIds: IEvidQueryPopulation["unitIds"];

  /**
   * Effective graph input when the population represents a reference.
   *
   * Claim populations leave this undefined because they do not own a reference policy.
   */
  public readonly reference: IEvidQueryPopulation["reference"];

  /**
   * Evaluated obligation ledger for a reference population.
   *
   * Coverage inspection uses this alongside structural selection; claim entries omit it.
   */
  public readonly obligation: IEvidQueryPopulation["obligation"];

  /**
   * Full inventory indexed by semantic unit identity.
   *
   * Parent traversal follows these explicit links instead of inferring ownership
   * from public accessor prefixes.
   */
  public readonly units: Map<string, IEvidUnit>;

  /**
   * Explicitly selected identities used for direct membership checks.
   *
   * Structural ancestors belong to configured closure separately and do not
   * increase this population's selected denominator.
   */
  public readonly selected: Set<string>;

  /**
   * Selected identities together with their existing structural ancestors.
   *
   * Withdrawn identities remain in this set for exact target applicability even
   * though visible discovery output excludes them.
   */
  public readonly configured = new Set<string>();

  /**
   * Configured identities with neither an own withdrawal nor a withdrawn ancestor.
   *
   * List queries use this set to avoid advertising hidden public targets as visible API.
   */
  public readonly visible = new Set<string>();

  /**
   * Public addresses grouped by semantic identity in inventory order.
   *
   * Formatting later sorts and deduplicates target spellings for each query row.
   */
  public readonly addresses = new Map<string, IEvidPublicAddress[]>();

  /**
   * Cached selected-descendant lists keyed by queried ancestor identity.
   *
   * The immutable snapshot boundary lets repeated coverage queries reuse traversal results.
   */
  private readonly descendants = new Map<string, string[]>();

  /**
   * Builds selection, visibility, and address indexes over an owned analysis population.
   *
   * This constructor does not clone records itself; the containing facade supplies
   * isolated data. Parent walks stop at cycles or missing units so inspection cannot loop.
   */
  public constructor(population: IEvidQueryPopulation) {
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
    // Preserve structural closure before applying withdrawal. Exact inspection
    // still needs to recognize a configured target and explain why it is hidden.
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

  /**
   * Returns selected descendants in configured order, including a selected ancestor itself.
   *
   * The cached result follows explicit parent relationships. Callers receive a
   * readonly view because mutating it would corrupt subsequent coverage summaries.
   */
  public selectedDescendants(ancestorId: string): readonly string[] {
    const remembered = this.descendants.get(ancestorId);
    if (remembered !== undefined) return remembered;
    const descendants = this.unitIds.filter((unitId) =>
      this.descends(unitId, ancestorId),
    );
    this.descendants.set(ancestorId, descendants);
    return descendants;
  }

  /**
   * Tests whether an identity belongs to an ancestor's explicit structural subtree.
   *
   * A unit descends from itself. Missing parents and cycles terminate the walk,
   * and literal dots in names never invent another ownership edge.
   */
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
