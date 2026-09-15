import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { IEvidRustDocumentationAttachment } from "./IEvidRustDocumentationAttachment";

/**
 * Retains one Rust documentation carrier, including unsupported tagged text.
 *
 * The adapter delays attachment until public occurrences and inherited withdrawals
 * are known, while preserving unsupported annotations as diagnosable hosts.
 */
export interface IEvidRustDocumentation {
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
  range: IEvidSourceRange;

  /**
   * Delimiter and tag rules for Rust line, block, and attribute documentation.
   *
   * EvidDocumentation uses them to retain source-to-text mappings.
   */
  syntax: IEvidCommentSyntax;

  /**
   * Declaration sites directly associated with this carrier.
   *
   * Publication and withdrawal filtering decide which sites reach a visible host.
   */
  attachments: IEvidRustDocumentationAttachment[];

  /**
   * Module path receiving an inner comment that documents the module.
   *
   * Omission means the carrier attaches to item declarations instead.
   */
  innerModulePath?: string[];
}
