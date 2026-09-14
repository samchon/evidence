import type {
  EvidenceProgrammingType,
  EvidenceDatabaseType,
  EvidenceProgrammingSymbol,
  EvidenceDatabaseSymbol,
  IEvidenceAdapter,
} from "@wrtnlabs/evidence";
import type { IAdapterCertificationFailure } from "./IAdapterCertificationFailure";
import type { IAdapterCertificationFalsePositive } from "./IAdapterCertificationFalsePositive";
import type { IAdapterCertificationHost } from "./IAdapterCertificationHost";
import type { IAdapterCertificationMutation } from "./IAdapterCertificationMutation";
import type { IAdapterCertificationRequirement } from "./IAdapterCertificationRequirement";
import type { IAdapterCertificationSource } from "./IAdapterCertificationSource";
import type { IAdapterCertificationUnitBase } from "./IAdapterCertificationUnitBase";

/** Complete executable contract required before a programming adapter is certified. */
export interface IAdapterCertificationBase<
  TType extends EvidenceProgrammingType | EvidenceDatabaseType,
  TSymbol extends EvidenceProgrammingSymbol | EvidenceDatabaseSymbol,
> {
  type: TType;
  adapter: IEvidenceAdapter;
  sources: IAdapterCertificationSource[];
  units: IAdapterCertificationUnitBase<TSymbol>[];
  hosts: IAdapterCertificationHost[];
  requirements: IAdapterCertificationRequirement[];
  excludedUnits: string[];
  annotationRanges: number;
  incomplete: IAdapterCertificationFailure;
  malformed: IAdapterCertificationFailure;
  falsePositive: IAdapterCertificationFalsePositive;
  mutation: IAdapterCertificationMutation;
}
