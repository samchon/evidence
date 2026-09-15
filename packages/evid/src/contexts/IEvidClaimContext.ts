import type { IEvidMaterializedClaim } from "../internal/IEvidMaterializedClaim";
import type { IEvidHost } from "../structures/IEvidHost";
import type { IEvidInventory } from "../structures/IEvidInventory";

/**
 * Holds claim-local indexes while materializing graph reference obligations.
 *
 * Preparation reconciles the claim inventory once, maps declarations to the
 * references where they apply, and keeps review applicability separate. Graph
 * construction consumes this context before it creates per-reference resolution
 * state, preserving independent obligations under one claim.
 */
export interface IEvidClaimContext {
  /**
   * Materialized claim input before graph-specific contexts are produced.
   *
   * It contains the configuration-plan coordinates and adapter inventories from
   * the same checker execution, which keeps declaration locations aligned.
   */
  readonly materialized: IEvidMaterializedClaim;

  /**
   * Reconciled claim inventory that receives preparation diagnostics.
   *
   * Invalid hosts or participation targets make this inventory incomplete so
   * later graph evaluation can preserve the failure instead of dropping records.
   */
  readonly inventory: IEvidInventory;

  /**
   * Claim hosts indexed by the semantic identity that owns their annotations.
   *
   * Multiple physical sites can describe one host identity; the map provides the
   * canonical semantic attachment point used during acknowledgement matching.
   */
  readonly hosts: Map<string, IEvidHost>;

  /**
   * Reference positions to which each acknowledgement applies for coverage.
   *
   * The set preserves repeated reference boundaries. An absent entry means the
   * declaration is not eligible to satisfy any reference under this claim.
   */
  readonly declarations: Map<string, Set<number>>;

  /**
   * Reference positions to which each review applies, independent of coverage.
   *
   * A review can target a reference without being an acknowledgement. Keeping its
   * index separately prevents review metadata from changing coverage counts.
   */
  readonly reviews: Map<string, Set<number>>;
}
