import type { EvidSeverity } from "../typings/EvidSeverity";
import type { IEvidGraphReference } from "./IEvidGraphReference";
import type { IEvidInventory } from "./IEvidInventory";

/**
 * A materialized claim's semantic hosts and independent evidence requirements.
 *
 * The inventory supplies physical declarations and annotations; `unitIds` selects
 * the semantic hosts that participate. Reference entries supply their own target
 * inventories, selectors, and policies. Shared source files or labels do not
 * combine the coverage owed by different claims.
 *
 * Exclusion carrier restrictions narrow eligible positions within this claim.
 * They do not create hosts or widen the claim's selected population.
 */
export interface IEvidGraphClaim {
  /**
   * Original zero-based position in the configuration's claim array.
   *
   * Omission uses this record's array position for direct graph callers. Explicit
   * indices preserve attribution after the checker filters inactive claims.
   */
  index?: number;

  /**
   * Optional human-readable label for claim diagnostics.
   *
   * Labels do not participate in identity. Two claims with equal names still
   * retain independent hosts, references, and coverage findings.
   */
  name?: string;

  /**
   * Effective claim severity, including the inactive off state.
   *
   * An off claim skips reference evaluation. Active claims attach this level to
   * findings originating from their own inventory and host participation.
   */
  severity: EvidSeverity;

  /**
   * Captured declaration and documentation inventory for the claim.
   *
   * Evaluation reconciles its records and validates ownership before selecting
   * hosts. Incompleteness prevents its references from producing a coverage pass.
   */
  inventory: IEvidInventory;

  /**
   * Semantic identities selected as evidence hosts.
   *
   * Eligible hosts without tags remain part of this population, allowing zero
   * acknowledgements to fail cardinality and checklist policies.
   */
  unitIds: string[];

  /**
   * Carrier IDs permitted to write exclusions for this claim.
   *
   * Omission permits every otherwise eligible attached public host. An explicit
   * selection restricts carriers without granting attachment to an invalid host.
   */
  exclusionHostIds?: string[];

  /**
   * Target populations this claim must acknowledge independently.
   *
   * Repeated selections retain separate policies and diagnostic boundaries. An
   * acknowledgement accepted by one reference may still be refused by another.
   */
  references: IEvidGraphReference[];
}
