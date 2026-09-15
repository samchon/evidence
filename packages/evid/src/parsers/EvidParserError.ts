import type { IEvidSourceRange } from "../structures/IEvidSourceRange";
import type { EvidParserErrorCode } from "../typings/EvidParserErrorCode";

/**
 * Parser failure preserving its category, affected source, and underlying cause.
 *
 * Adapters translate these fields into incomplete-inventory diagnostics, and watch
 * uses acquisition categories to decide whether timed recovery is appropriate.
 * A range is available for syntax failures but may be absent before source parsing
 * begins, such as when grammar acquisition cannot complete.
 */
export class EvidParserError extends Error {
  /**
   * Creates a source-qualified error without discarding the original failure cause.
   *
   * The message includes the file for ordinary Error consumers; structured callers
   * can inspect the category and optional span without parsing that message.
   */
  public constructor(
    /**
     * Stable parser or acquisition failure category.
     *
     * Adapters use it in diagnostic codes and watch uses it to classify retryable
     * preparation failures.
     */
    public readonly code: EvidParserErrorCode,

    /**
     * Source or asset identifier affected by the failed operation.
     *
     * This remains useful even when no syntax tree exists to provide a source span.
     */
    public readonly file: string,

    /**
     * Human-readable explanation of the failed parser operation.
     *
     * The constructor prefixes this text with `file` for ordinary Error consumers;
     * structured consumers should use `code`, `file`, and `range` for classification.
     */
    message: string,

    /**
     * Precise source span when the failure can be attributed to parsed syntax.
     *
     * Omission denotes a file- or acquisition-level failure without invented coordinates.
     */
    public readonly range?: IEvidSourceRange,

    /**
     * Native error metadata retained as this Error's optional cause.
     *
     * Omission means the parser has no lower-level exception to preserve, such as a
     * detected incomplete syntax tree.
     */
    options?: ErrorOptions,
  ) {
    super(`${file}: ${message}`, options);
    this.name = "EvidParserError";
  }
}
