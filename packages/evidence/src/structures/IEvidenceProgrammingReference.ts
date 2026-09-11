import type { EvidenceProgrammingSymbol } from "../typings/EvidenceProgrammingSymbol";
import type { EvidenceProgrammingType } from "../typings/EvidenceProgrammingType";
import type { IEvidenceReferenceBase } from "./IEvidenceReferenceBase";

/** Public code declarations that the owning claim must cite. */
export interface IEvidenceProgrammingReference extends IEvidenceReferenceBase<EvidenceProgrammingType> {
  /**
   * Required source-file globs relative to root, using the ordered include and
   * exclude rules of claim file globs. Files are read directly
   * from disk without TypeScript Program membership or package-entry resolution.
   * The type selects the language; file names identify variants such as TSX.
   */
  files: string[];

  /**
   * Evidence symbol kinds; accepts one kind or a nonempty array. Unselected
   * type and namespace ancestors remain addressable as aggregate targets.
   *
   * @default type
   */
  symbol?: EvidenceProgrammingSymbol | EvidenceProgrammingSymbol[];
}
