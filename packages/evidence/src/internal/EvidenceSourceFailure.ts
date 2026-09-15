import type { IEvidenceSourceDiagnostic } from "../structures/IEvidenceSourceDiagnostic";

/**
 * Discovery failure carrying the source diagnostic category that callers
 * report.
 *
 * The collector converts these failures at filesystem boundaries, separating
 * expected source conditions from unexpected operational errors.
 */
export class EvidenceSourceFailure extends Error {
  /**
   * Creates a source-discovery failure with a reportable diagnostic code.
   *
   * `EvidenceSourceCollector` catches this expected failure at filesystem
   * boundaries and preserves its category instead of collapsing it into a
   * generic read error.
   */
  public constructor(
    public readonly code: IEvidenceSourceDiagnostic["code"],
    message: string,
  ) {
    super(message);
  }
}
