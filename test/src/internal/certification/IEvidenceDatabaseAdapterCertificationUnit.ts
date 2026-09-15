import type { EvidenceDatabaseSymbol } from "@wrtnlabs/evidence";
import type { IEvidenceAdapterCertificationUnitBase } from "./IEvidenceAdapterCertificationUnitBase";

/** Expected exact inventory for one database declaration. */
export interface IEvidenceDatabaseAdapterCertificationUnit extends IEvidenceAdapterCertificationUnitBase<EvidenceDatabaseSymbol> {}
