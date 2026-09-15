import type { EvidProgrammingSymbol } from "evid";
import type { IEvidAdapterCertificationUnitBase } from "./IEvidAdapterCertificationUnitBase";

/** Expected exact inventory for one programming declaration. */
export interface IEvidAdapterCertificationUnit extends IEvidAdapterCertificationUnitBase<EvidProgrammingSymbol> {}
