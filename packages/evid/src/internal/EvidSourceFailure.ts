import type { IEvidSourceDiagnostic } from "../structures/IEvidSourceDiagnostic";

/**
 * Discovery failure carrying the source diagnostic category that callers report.
 *
 * The collector converts these failures at filesystem boundaries, separating
 * expected source conditions from unexpected operational errors.
 */
export class EvidSourceFailure extends Error {
  /**
   * Creates a source-discovery failure with a reportable diagnostic code.
   *
   * `EvidSourceCollector` catches this expected failure at filesystem boundaries and
   * preserves its category instead of collapsing it into a generic read error.
   */
  public constructor(
    public readonly code: IEvidSourceDiagnostic["code"],
    message: string,
  ) {
    super(message);
  }
}
