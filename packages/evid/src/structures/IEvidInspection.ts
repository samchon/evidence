import type { EvidTargetResolutionStatus } from "../typings/EvidTargetResolutionStatus";
import type { IEvidDiagnostic } from "./IEvidDiagnostic";
import type { IEvidInspectedAcknowledgement } from "./IEvidInspectedAcknowledgement";
import type { IEvidInspectedObligation } from "./IEvidInspectedObligation";
import type { IEvidInspectedReview } from "./IEvidInspectedReview";
import type { IEvidInspectedUnit } from "./IEvidInspectedUnit";
import type { IEvidQueryScope } from "./IEvidQueryScope";
import type { IEvidWithdrawal } from "./IEvidWithdrawal";

/**
 * Resolution and evidence context for a target within one configured
 * population.
 *
 * Candidate units retain structural and fingerprint details even when
 * resolution is ambiguous or hidden. Incoming acknowledgements, reviews, and
 * obligation state are gathered within the same reference boundary rather than
 * pooled across unrelated claims.
 */
export interface IEvidInspection {
  /**
   * Claim or reference population against which the target was resolved.
   *
   * This boundary determines selection, target grammar, and related
   * obligations.
   */
  scope: IEvidQueryScope;

  /**
   * Parsing, visibility, and uniqueness result for this population.
   *
   * Candidate details do not imply successful resolution when the status is
   * ambiguous or hidden.
   */
  status: EvidTargetResolutionStatus;

  /**
   * Deduplicated, sorted target spellings derived from attempted public
   * addresses.
   *
   * Formatting follows the artifact grammar and the query's base directory
   * where applicable.
   */
  addresses: string[];

  /**
   * Candidate identities with declaration, child, host, and fingerprint
   * context.
   *
   * Resolution failures with no semantic candidate leave this collection empty.
   */
  units: IEvidInspectedUnit[];

  /**
   * Withdrawal annotations explaining hidden target candidates.
   *
   * Original locations remain available when exclusion was inherited from a
   * parent.
   */
  withdrawals: IEvidWithdrawal[];

  /**
   * Reference obligation states associated with inspected selected units or
   * ancestors.
   *
   * Claim populations and identities outside the reference selection contribute
   * no entries.
   */
  obligations: IEvidInspectedObligation[];

  /**
   * Accepted incoming acknowledgements that name or cover the inspected
   * identities.
   *
   * These are scoped to this reference; refused or unresolved statements are
   * not accepted edges.
   */
  acknowledgements: IEvidInspectedAcknowledgement[];

  /**
   * Incoming reviews whose resolved candidate scopes contain inspected
   * identities.
   *
   * Resolution status is retained; appearing here does not prove freshness or
   * acknowledgement pairing.
   */
  reviews: IEvidInspectedReview[];

  /**
   * Target-resolution findings attributed to this configuration scope.
   *
   * The enclosing report combines these with diagnostics from the original
   * check.
   */
  diagnostics: IEvidDiagnostic[];
}
