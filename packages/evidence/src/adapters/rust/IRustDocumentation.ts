import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IRustDocumentationAttachment } from "./IRustDocumentationAttachment";

/**
 * Retains one Rust documentation carrier, including unsupported tagged text.
 *
 * The adapter delays attachment until public occurrences and inherited withdrawals
 * are known, while preserving unsupported annotations as diagnosable hosts.
 */
export interface IRustDocumentation {
  /**
   * Stable source-region identity for this documentation carrier.
   *
   * It becomes the evidence-host ID after attachment or unsupported-host creation.
   */
  id: string;

  /**
   * Original documentation range excluded from its owner's review content.
   *
   * The range preserves tag coordinates after parser resources close.
   */
  range: IEvidenceSourceRange;

  /**
   * Delimiter and tag rules for Rust line, block, and attribute documentation.
   *
   * EvidenceDocumentation uses them to retain source-to-text mappings.
   */
  syntax: IEvidenceCommentSyntax;

  /**
   * Declaration sites directly associated with this carrier.
   *
   * Publication and withdrawal filtering decide which sites reach a visible host.
   */
  attachments: IRustDocumentationAttachment[];

  /**
   * Module path receiving an inner comment that documents the module.
   *
   * Omission means the carrier attaches to item declarations instead.
   */
  innerModulePath?: string[];
}
