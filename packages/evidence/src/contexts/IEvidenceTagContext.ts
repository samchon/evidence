import type { IPendingEvidenceTag } from "../internal/IPendingEvidenceTag";
import type { SourceText } from "../internal/SourceText";
import type { IEvidenceDocumentation } from "../structures/IEvidenceDocumentation";
import type { IEvidenceHost } from "../structures/IEvidenceHost";
import type { IEvidenceTagParseResult } from "../structures/IEvidenceTagParseResult";

/**
 * Holds the mutable state used while one adapter parses an annotation block.
 *
 * The parser supplies immutable source, host, and documentation boundaries, then
 * advances the pending tag and Markdown-fence state line by line. Keeping this
 * state per invocation prevents an unterminated tag or code fence in one file
 * from changing how another file is interpreted.
 */
export interface IEvidenceTagContext {
  /**
   * Original source text used to translate documentation offsets into locations.
   *
   * Diagnostics and parsed declarations use these coordinates to point back into
   * the physical file rather than reporting offsets relative to a copied comment.
   */
  readonly source: SourceText;

  /**
   * Adapter-established declaration that owns every annotation parsed here.
   *
   * The tag parser never derives ownership from prose. Its consumer relies on
   * this host identity when it later connects acknowledgements to graph claims.
   */
  readonly host: IEvidenceHost;

  /**
   * Normalized documentation text and its language-specific source boundaries.
   *
   * It determines which lines count as annotation content and maps each retained
   * character to the original source position after comment syntax is removed.
   */
  readonly documentation: IEvidenceDocumentation;

  /**
   * Parsed annotations and diagnostics accumulated for this documentation block.
   *
   * The caller receives this shared result after end-of-input finalization, so a
   * malformed tag can coexist with annotations that were parsed successfully.
   */
  readonly result: IEvidenceTagParseResult;

  /**
   * Tag whose value may still accept continuation lines.
   *
   * An empty boundary or a new tag finalizes this pending record. `undefined`
   * means the next content line must begin a tag rather than extend one.
   */
  pending: IPendingEvidenceTag | undefined;

  /**
   * Opening marker for the active fenced code region.
   *
   * An empty string means ordinary tag parsing is active. While nonempty, lines
   * are treated as literal code until a compatible closing marker is found.
   */
  fence: string;

  /**
   * Minimum run length required for the active fence's closing marker.
   *
   * A shorter run of the same marker remains code content. This preserves nested
   * fence text instead of terminating the outer annotation value prematurely.
   */
  fenceLength: number;
}
