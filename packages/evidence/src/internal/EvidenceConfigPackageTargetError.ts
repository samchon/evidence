/**
 * Marks one invalid package-map target that an array alternative may skip.
 *
 * Node permits array fallbacks after target-validation failures but still
 * rejects malformed condition objects. EvidenceConfigDependencyScanner uses this
 * error boundary to preserve that distinction without matching diagnostic
 * text.
 */
export class EvidenceConfigPackageTargetError extends Error {
  /**
   * Creates a skippable target failure while retaining its validation cause.
   *
   * The original cause remains available when no later array alternative can be
   * selected and the scanner must expose the package-resolution failure.
   */
  public constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "EvidenceConfigPackageTargetError";
  }
}
