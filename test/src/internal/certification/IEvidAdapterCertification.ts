import type {
  EvidProgrammingType,
  EvidProgrammingSymbol,
} from "evid";
import type { IEvidAdapterCertificationBase } from "./IEvidAdapterCertificationBase";

/** Complete executable contract for one programming adapter. */
export interface IEvidAdapterCertification extends IEvidAdapterCertificationBase<
  EvidProgrammingType,
  EvidProgrammingSymbol
> {}
