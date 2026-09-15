import type { IEvidCommentSyntax } from "../../structures/IEvidCommentSyntax";
import type { IEvidDocumentation } from "../../structures/IEvidDocumentation";
import type { IEvidSourceRange } from "../../structures/IEvidSourceRange";
import type { IEvidPythonDocumentationAttachment } from "./IEvidPythonDocumentationAttachment";

/**
 * Retains one Python docstring or adjacent comment run after parsing.
 *
 * The scanner keeps source coordinates and either a precomputed mapping or the
 * syntax needed to derive one. EvidPythonAdapterBase attaches the text only
 * after it knows which declarations are part of the public export surface.
 */
export interface IEvidPythonDocumentation {
  /**
   * Stable identifier for this text region within its source file.
   *
   * It becomes the evidence-host ID when the text is supported and attached.
   */
  id: string;

  /**
   * Byte and coordinate range occupied by the original documentation text.
   *
   * Annotation ranges exclude this source slice from a unit fingerprint when it
   * contains Evid directives.
   */
  range: IEvidSourceRange;

  /**
   * Delimiter rules for mapping a raw docstring or comment run on demand.
   *
   * Omission means `mapping` already carries the normalized documentation;
   * neither form may be absent when the adapter parses evidence tags.
   */
  syntax?: IEvidCommentSyntax;

  /**
   * Normalized documentation text when scanning already established its shape.
   *
   * The adapter clones this mapping before tag parsing because attachment and
   * withdrawal phases must not mutate scanner-owned analysis data.
   */
  mapping?: IEvidDocumentation;

  /**
   * Declaration positions and candidate units that this text can document.
   *
   * One text region can attach to several accessors at one position; export and
   * withdrawal filtering determine its final visible host membership.
   */
  attachments: IEvidPythonDocumentationAttachment[];
}
