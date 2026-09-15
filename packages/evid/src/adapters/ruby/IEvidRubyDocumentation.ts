import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidDocumentation } from "../../structures/IEvidDocumentation";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { IEvidRubyDocumentationAttachment } from "./IEvidRubyDocumentationAttachment";

/**
 * Retains one Ruby comment run or annotation-bearing unsupported literal.
 *
 * EvidRubyAdapterBase attaches it after reopened declaration groups become public, keeping
 * tags on invalid positions available for diagnostics rather than discarding them.
 */
export interface IEvidRubyDocumentation {
  /**
   * Stable identity for the source documentation region.
   *
   * It becomes the evidence-host ID after attachment or unsupported-host creation.
   */
  id: string;

  /**
   * Original text range occupied by the comment run or literal.
   *
   * Annotation ranges exclude this text from associated site fingerprints.
   */
  range: IEvidSourceRange;

  /**
   * Delimiter rules used to map raw text when scanning did not precompute a mapping.
   *
   * Omission means `mapping` supplies normalized content for tag parsing.
   */
  syntax?: IEvidCommentSyntax;

  /**
   * Precomputed documentation mapping when the carrier needs custom normalization.
   *
   * The adapter uses this instead of syntax to retain original tag coordinates.
   */
  mapping?: IEvidDocumentation;

  /**
   * Declaration sites immediately documented by this carrier.
   *
   * Public-group and withdrawal filtering determine the final host membership.
   */
  attachments: IEvidRubyDocumentationAttachment[];
}
