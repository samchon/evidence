import type { EvidenceDatabaseSymbol } from "@wrtnlabs/evidence";
import type { IAdapterCertificationUnitBase } from "./IAdapterCertificationUnitBase";

/** Expected exact inventory for one database declaration. */
export interface IDatabaseAdapterCertificationUnit extends IAdapterCertificationUnitBase<EvidenceDatabaseSymbol> {}
