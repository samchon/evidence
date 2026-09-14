/** Invalid CLI syntax that must finish without loading project configuration. */
export class EvidenceCommandError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EvidenceCommandError";
  }
}
