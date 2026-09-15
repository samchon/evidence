import type {
  EvidenceProgrammingType,
  EvidenceProgrammingSymbol,
} from "@wrtnlabs/evidence";
import type { IEvidenceAdapterCertificationBase } from "./IEvidenceAdapterCertificationBase";

/** Complete executable contract for one programming adapter. */
export interface IEvidenceAdapterCertification extends IEvidenceAdapterCertificationBase<
  EvidenceProgrammingType,
  EvidenceProgrammingSymbol
> {}
