import type { IEvidenceCommentSyntax } from "../../structures/IEvidenceCommentSyntax";
import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";

/** Parser-recognized documentation with established semantic owners. */
export interface IDbmlDocumentation {
  /** Literal identities of declarations documented by this carrier. */
  owners: string[][];

  /** Original comment or note string range. */
  range: IEvidenceSourceRange;

  /** Full syntax to omit from semantic fingerprints. */
  annotationRange: IEvidenceSourceRange;

  /** Delimiters used by mapped documentation decoding. */
  syntax: IEvidenceCommentSyntax;
}
