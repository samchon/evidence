import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IEvidencePythonDocumentationAttachment } from "./IEvidencePythonDocumentationAttachment";

/**
 * Retains one Python docstring or adjacent comment run after parsing.
 *
 * The scanner keeps source coordinates and either a precomputed mapping or the
 * syntax needed to derive one. EvidencePythonAdapter attaches the text only after
 * it knows which declarations are part of the public export surface.
 */
export interface IEvidencePythonDocumentation {
  /**
   * Stable identifier for this text region within its source file.
   *
   * It becomes the Evidence-host ID when the text is supported and attached.
   */
  id: string;

  /**
   * Byte and coordinate range occupied by the original documentation text.
   *
   * Annotation ranges exclude this source slice from a unit fingerprint when it
   * contains evidence directives.
   */
  range: IEvidenceSourceRange;

  /**
   * Delimiter rules for mapping a raw docstring or comment run on demand.
   *
   * Omission means `mapping` already carries the normalized documentation;
   * neither form may be absent when the adapter parses Evidence tags.
   */
  syntax?: IEvidenceCommentSyntax;

  /**
   * Normalized documentation text when scanning already established its shape.
   *
   * The adapter clones this mapping before tag parsing because attachment and
   * withdrawal phases must not mutate scanner-owned analysis data.
   */
  mapping?: IEvidenceDocumentation;

  /**
   * Declaration positions and candidate units that this text can document.
   *
   * One text region can attach to several accessors at one position; export and
   * withdrawal filtering determine its final visible host membership.
   */
  attachments: IEvidencePythonDocumentationAttachment[];
}
