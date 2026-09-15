import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { IEvidCppDocumentationAttachment } from "./IEvidCppDocumentationAttachment";

/**
 * Captures one C++ documentation carrier that may contain Evid tags.
 *
 * EvidCppFileScanner collects supported Doxygen and tag-bearing unsupported
 * carriers, then records their physical attachments. EvidCppAdapterBase later reads
 * the carrier with its syntax, maps attachments through materialized units,
 * and emits attached or unsupported Evid hosts without treating a comment
 * as a declaration itself.
 */
export interface IEvidCppDocumentation {
  /** Stable comment key referenced by source attachments and evidence parsing.
   *
   * It identifies the physical comment, not a semantic declaration. */
  id: string;

  /** Exact source span excluded from content fingerprints after annotation parsing.
   *
   * The range preserves the carrier location for diagnostics. */
  range: IEvidSourceRange;

  /** Delimiter and indentation rules required to read this Doxygen carrier.
   *
   * Evid parsing uses the syntax instead of guessing from raw source text. */
  syntax: IEvidCommentSyntax;

  /** Supported declaration sites that accept this carrier as documentation.
   *
   * Attachment is established during scanning before alias materialization. */
  attachments: IEvidCppDocumentationAttachment[];
}
