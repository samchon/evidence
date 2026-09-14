import type {
  EvidenceProgrammingType,
  EvidenceProgrammingSymbol,
} from "@wrtnlabs/evidence";
import type { IAdapterCertificationBase } from "./IAdapterCertificationBase";

/** Complete executable contract for one programming adapter. */
export interface IAdapterCertification extends IAdapterCertificationBase<
  EvidenceProgrammingType,
  EvidenceProgrammingSymbol
> {}
