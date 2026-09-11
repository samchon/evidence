import type { IEvidenceDeclaration } from "./IEvidenceDeclaration";
import type { IEvidenceDiagnostic } from "./IEvidenceDiagnostic";
import type { IEvidenceHost } from "./IEvidenceHost";
import type { IEvidencePublicAddress } from "./IEvidencePublicAddress";
import type { IEvidenceReview } from "./IEvidenceReview";
import type { IEvidenceSourceDependency } from "./IEvidenceSourceDependency";
import type { IEvidenceSourceFile } from "./IEvidenceSourceFile";
import type { IEvidenceUnit } from "./IEvidenceUnit";

/** Language-neutral adapter output, containing no live parser or compiler objects. */
export interface IEvidenceInventory {
  schemaVersion: 1;
  sources: IEvidenceSourceFile[];
  units: IEvidenceUnit[];
  addresses: IEvidencePublicAddress[];
  hosts: IEvidenceHost[];
  declarations: IEvidenceDeclaration[];
  reviews: IEvidenceReview[];
  diagnostics: IEvidenceDiagnostic[];
  dependencies: IEvidenceSourceDependency[];
  /** False preserves partial analysis; healthy empty inventories remain true. */
  complete: boolean;
}
