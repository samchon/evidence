import type { IEvidenceUnit } from "./IEvidenceUnit";
import type { IEvidenceWithdrawal } from "./IEvidenceWithdrawal";

/**
 * Exact inventory lookup within a selected population's structural scope.
 *
 * This lower-level result assumes the public address has already been parsed.
 * It deduplicates aliases by semantic identity and preserves withdrawn matches.
 * Incomplete inventory takes precedence because partial extraction cannot prove
 * either uniqueness or absence.
 */
export interface IEvidenceResolution {
  /**
   * Visibility and uniqueness outcome of the address lookup.
   *
   * Missing means no matching scope was found in a complete inventory;
   * incomplete means the available candidates cannot establish a trustworthy
   * answer.
   */
  status: "resolved" | "ambiguous" | "hidden" | "missing" | "incomplete";

  /**
   * Visible matches, or withdrawn matches when no visible match exists.
   *
   * Multiple aliases of one identity produce one entry; distinct identities can
   * remain ambiguous at the same public address.
   */
  units: IEvidenceUnit[];

  /**
   * Deduplicated withdrawal records associated with hidden matches.
   *
   * These identify the source annotations responsible for inherited exclusion.
   */
  withdrawals: IEvidenceWithdrawal[];
}
