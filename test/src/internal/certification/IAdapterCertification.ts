import type {
  EvidProgrammingType,
  EvidProgrammingSymbol,
} from "evid";
import type { IAdapterCertificationBase } from "./IAdapterCertificationBase";

/** Complete executable contract for one programming adapter. */
export interface IAdapterCertification extends IAdapterCertificationBase<
  EvidProgrammingType,
  EvidProgrammingSymbol
> {}
