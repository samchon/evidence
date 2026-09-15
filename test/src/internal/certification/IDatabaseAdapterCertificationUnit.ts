import type { EvidDatabaseSymbol } from "evid";
import type { IAdapterCertificationUnitBase } from "./IAdapterCertificationUnitBase";

/** Expected exact inventory for one database declaration. */
export interface IDatabaseAdapterCertificationUnit extends IAdapterCertificationUnitBase<EvidDatabaseSymbol> {}
