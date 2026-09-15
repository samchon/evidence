import type { EvidProgrammingSymbol } from "evid";
import type { IAdapterCertificationUnitBase } from "./IAdapterCertificationUnitBase";

/** Expected exact inventory for one programming declaration. */
export interface IAdapterCertificationUnit extends IAdapterCertificationUnitBase<EvidProgrammingSymbol> {}
