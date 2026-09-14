import type { EvidenceTargetResolutionStatus } from "../typings/EvidenceTargetResolutionStatus";
import type { IEvidenceAddress } from "./IEvidenceAddress";
import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceUnit } from "./IEvidenceUnit";
import type { IEvidenceWithdrawal } from "./IEvidenceWithdrawal";

/**
 * Resolution outcome for an authored target within one reference population.
 *
 * The resolver retains attempted addresses and candidate units even when it cannot
 * accept a unique visible target. Diagnostics distinguish malformed spelling,
 * unavailable files, selection boundaries, and incomplete extraction so callers
 * do not report every failure as a missing member.
 */
export interface IEvidenceTargetResolution {
  /**
   * Classification of target parsing, population lookup, or access failure.
   *
   * Only a resolved outcome establishes a unique visible target; coverage and
   * review policy still need to be evaluated afterward.
   */
  status: EvidenceTargetResolutionStatus;

  /**
   * Candidate public addresses produced by the artifact's target grammar.
   *
   * File-qualified targets can produce several absolute paths when a merged host
   * retains multiple origins. Synthetic artifact grammars retain their own file
   * keys, and malformed targets may produce no addresses.
   */
  addresses: IEvidenceAddress[];

  /**
   * Semantic candidates retained by the resolution outcome.
   *
   * Resolved results identify one visible unit; ambiguity retains competitors.
   * Hidden results retain withdrawn candidates for an actionable explanation.
   */
  units: IEvidenceUnit[];

  /**
   * Withdrawal annotations explaining hidden candidate identities.
   *
   * Locations can belong to structural ancestors whose withdrawal propagates
   * into the cited declaration.
   */
  withdrawals: IEvidenceWithdrawal[];

  /**
   * Findings explaining why resolution could not establish an accepted target.
   *
   * Incomplete outcomes retain underlying inventory failures so lost extraction
   * cannot masquerade as an ordinary empty selection.
   */
  diagnostics: IEvidenceDiagnostic[];
}
