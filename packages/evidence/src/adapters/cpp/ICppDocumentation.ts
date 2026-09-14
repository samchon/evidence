import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { ICppDocumentationAttachment } from "./ICppDocumentationAttachment";

/**
 * Captures one C++ documentation carrier that may contain Evidence tags.
 *
 * CppFileScanner collects supported Doxygen and tag-bearing unsupported
 * carriers, then records their physical attachments. CppAdapter later reads
 * the carrier with its syntax, maps attachments through materialized units,
 * and emits attached or unsupported Evidence hosts without treating a comment
 * as a declaration itself.
 */
export interface ICppDocumentation {
  /** Stable comment key referenced by source attachments and evidence parsing.
   *
   * It identifies the physical comment, not a semantic declaration. */
  id: string;

  /** Exact source span excluded from content fingerprints after annotation parsing.
   *
   * The range preserves the carrier location for diagnostics. */
  range: IEvidenceSourceRange;

  /** Delimiter and indentation rules required to read this Doxygen carrier.
   *
   * Evidence parsing uses the syntax instead of guessing from raw source text. */
  syntax: IEvidenceCommentSyntax;

  /** Supported declaration sites that accept this carrier as documentation.
   *
   * Attachment is established during scanning before alias materialization. */
  attachments: ICppDocumentationAttachment[];
}
