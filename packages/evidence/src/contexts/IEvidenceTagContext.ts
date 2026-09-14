import type { IPendingEvidenceTag } from "../internal/IPendingEvidenceTag";
import type { SourceText } from "../internal/SourceText";
import type { IEvidenceDocumentation } from "../structures/IEvidenceDocumentation";
import type { IEvidenceHost } from "../structures/IEvidenceHost";
import type { IEvidenceTagParseResult } from "../structures/IEvidenceTagParseResult";

/** Mutable annotation state belonging to exactly one parse invocation. */
export interface IEvidenceTagContext {
  /** Original source text used to map documentation offsets to coordinates. */
  readonly source: SourceText;

  /** Adapter-established host to which parsed annotations belong. */
  readonly host: IEvidenceHost;

  /** Documentation text, source mappings, and language-specific tag boundaries. */
  readonly documentation: IEvidenceDocumentation;

  /** Annotations and diagnostics accumulated during this invocation. */
  readonly result: IEvidenceTagParseResult;

  /** Annotation awaiting continuation lines or a terminating boundary. */
  pending: IPendingEvidenceTag | undefined;

  /** Active code-fence marker, or an empty string outside a fence. */
  fence: string;

  /** Minimum marker length required to close the active code fence. */
  fenceLength: number;
}
