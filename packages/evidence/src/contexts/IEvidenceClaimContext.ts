import type { IEvidenceMaterializedClaim } from "../internal/IEvidenceMaterializedClaim";
import type { IEvidenceHost } from "../structures/IEvidenceHost";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";

/** Claim inventory and participation indexes shared while preparing its references. */
export interface IEvidenceClaimContext {
  /** Selected claim and reference inventories before graph preparation. */
  readonly materialized: IEvidenceMaterializedClaim;

  /** Claim snapshot receiving participation diagnostics. */
  readonly inventory: IEvidenceInventory;

  /** Claim hosts indexed by their semantic attachment identity. */
  readonly hosts: Map<string, IEvidenceHost>;

  /** Reference positions to which each acknowledgement applies. */
  readonly declarations: Map<string, Set<number>>;

  /** Reference positions to which each review applies independently of acknowledgements. */
  readonly reviews: Map<string, Set<number>>;
}
