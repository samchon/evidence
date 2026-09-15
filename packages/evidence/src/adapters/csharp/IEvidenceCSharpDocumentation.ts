import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";
import type { IEvidenceCSharpDocumentationAttachment } from "./IEvidenceCSharpDocumentationAttachment";

/**
 * Retains one C# XML documentation carrier until the adapter creates evidence
 * hosts.
 *
 * EvidenceCSharpFileScanner records its physical range, comment syntax, and
 * accepted declaration sites without binding it to a semantic unit.
 * EvidenceCSharpAdapter later groups its attachments against published
 * declarations, then parses the same carrier either as attached documentation
 * or as an unsupported annotation.
 */
export interface IEvidenceCSharpDocumentation {
  /**
   * Identifies this carrier throughout scanning and host materialization.
   *
   * The scanner derives the key from the source-comment range. It remains
   * distinct from declaration, site, and semantic unit identifiers because one
   * carrier can attach to multiple physical declarations.
   */
  id: string;

  /**
   * Locates the complete XML documentation carrier in the physical source file.
   *
   * The adapter uses this span for hosts, annotation-range exclusions, and
   * diagnostics. Evidence tags are read only from these exact source bytes.
   */
  range: IEvidenceSourceRange;

  /**
   * Preserves the comment form required to normalize the carrier's XML text.
   *
   * EvidenceCSharpDocumentation passes it to the shared documentation reader so
   * line delimiters and indentation are removed according to the original
   * syntax.
   */
  syntax: IEvidenceCommentSyntax;

  /**
   * Names the declaration sites that the scanner accepted as this carrier's
   * owners.
   *
   * Each attachment preserves both a scanner-local declaration and its physical
   * site. Materialization uses this list to form hosts; it never broadens
   * ownership by searching nearby source text.
   */
  attachments: IEvidenceCSharpDocumentationAttachment[];
}
