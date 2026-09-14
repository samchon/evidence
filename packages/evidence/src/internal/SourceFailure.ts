import type { IEvidenceSourceDiagnostic } from "../structures/IEvidenceSourceDiagnostic";

/**
 * Discovery failure carrying the source diagnostic category that callers report.
 *
 * The collector converts these failures at filesystem boundaries, separating
 * expected source conditions from unexpected operational errors.
 */
export class SourceFailure extends Error {
  /** Creates a failure whose code is preserved when the collector emits a diagnostic. */
  public constructor(
    public readonly code: IEvidenceSourceDiagnostic["code"],
    message: string,
  ) {
    super(message);
  }
}
