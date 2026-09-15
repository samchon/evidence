/**
 * Invalid CLI syntax detected before configuration or source loading.
 *
 * The command parser uses this error for unknown, repeated, missing, or
 * incompatible arguments. Buffered execution turns it into actionable failure
 * output so malformed commands cannot trigger an unrelated project analysis.
 */
export class EvidCommandError extends Error {
  /**
   * Records the concrete argument failure for command-level repair guidance.
   *
   * The caller supplies the offending option or operation context; the command
   * boundary adds the general help instruction when rendering the failure.
   */
  public constructor(message: string) {
    super(message);
    this.name = "EvidCommandError";
  }
}
