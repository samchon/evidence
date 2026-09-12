import type { IEvidenceSourceRange } from "./IEvidenceSourceRange";

/** One declaration position owned by a semantic identity. */
export interface IEvidenceUnitSite {
  /** Adapter identity for the physical declaration, shared by multi-variable statements. */
  id: string;
  file: string;
  range: IEvidenceSourceRange;
  /** This unit's own content ranges; a sibling declarator need not contribute to its fingerprint. */
  content: IEvidenceSourceRange[];
}
