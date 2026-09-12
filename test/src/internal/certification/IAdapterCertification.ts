import type { IEvidenceAdapter } from "../../../../packages/evidence/src/structures/IEvidenceAdapter";
import type { EvidenceProgrammingType } from "../../../../packages/evidence/src/typings/EvidenceProgrammingType";
import type { IAdapterCertificationFailure } from "./IAdapterCertificationFailure";
import type { IAdapterCertificationFalsePositive } from "./IAdapterCertificationFalsePositive";
import type { IAdapterCertificationHost } from "./IAdapterCertificationHost";
import type { IAdapterCertificationMutation } from "./IAdapterCertificationMutation";
import type { IAdapterCertificationRequirement } from "./IAdapterCertificationRequirement";
import type { IAdapterCertificationSource } from "./IAdapterCertificationSource";
import type { IAdapterCertificationUnit } from "./IAdapterCertificationUnit";

/** Complete executable contract required before a programming adapter is certified. */
export interface IAdapterCertification {
  type: EvidenceProgrammingType;
  adapter: IEvidenceAdapter;
  sources: IAdapterCertificationSource[];
  units: IAdapterCertificationUnit[];
  hosts: IAdapterCertificationHost[];
  requirements: IAdapterCertificationRequirement[];
  excludedUnits: string[];
  annotationRanges: number;
  incomplete: IAdapterCertificationFailure;
  malformed: IAdapterCertificationFailure;
  falsePositive: IAdapterCertificationFalsePositive;
  mutation: IAdapterCertificationMutation;
}
