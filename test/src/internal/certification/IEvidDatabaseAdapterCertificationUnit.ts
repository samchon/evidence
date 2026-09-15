import type { EvidDatabaseSymbol } from "evid";
import type { IEvidAdapterCertificationUnitBase } from "./IEvidAdapterCertificationUnitBase";

/** Expected exact inventory for one database declaration. */
export interface IEvidDatabaseAdapterCertificationUnit extends IEvidAdapterCertificationUnitBase<EvidDatabaseSymbol> {}
