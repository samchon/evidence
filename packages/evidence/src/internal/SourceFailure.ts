import type { IEvidenceSourceDiagnostic } from "../structures/IEvidenceSourceDiagnostic";

/** A discovery failure with a stable diagnostic category. */
export class SourceFailure extends Error {
  public constructor(
    public readonly code: IEvidenceSourceDiagnostic["code"],
    message: string,
  ) {
    super(message);
  }
}
