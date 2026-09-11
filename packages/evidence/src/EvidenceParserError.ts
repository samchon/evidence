import type { IEvidenceSourceRange } from "./structures/IEvidenceSourceRange";
import type { EvidenceParserErrorCode } from "./typings/EvidenceParserErrorCode";

/** A parser failure with a stable category, affected file, and optional source span. */
export class EvidenceParserError extends Error {
  public constructor(
    public readonly code: EvidenceParserErrorCode,
    public readonly file: string,
    message: string,
    public readonly range?: IEvidenceSourceRange,
    options?: ErrorOptions,
  ) {
    super(`${file}: ${message}`, options);
    this.name = "EvidenceParserError";
  }
}
