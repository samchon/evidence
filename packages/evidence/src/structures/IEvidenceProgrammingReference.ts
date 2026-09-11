import type { EvidenceProgrammingSymbol } from "../typings/EvidenceProgrammingSymbol";
import type { EvidenceProgrammingType } from "../typings/EvidenceProgrammingType";
import type { IEvidenceReferenceBase } from "./IEvidenceReferenceBase";

/** Public code declarations that the owning claim must cite. */
export interface IEvidenceProgrammingReference extends IEvidenceReferenceBase<
  EvidenceProgrammingType,
  EvidenceProgrammingSymbol
> {
  /**
   * Source-file globs relative to root, using claim glob rules. Files are read
   * from disk without TypeScript Program membership or package-entry resolution.
   * The type selects the language; file names identify variants such as TSX.
   */
  files: string[];
}
