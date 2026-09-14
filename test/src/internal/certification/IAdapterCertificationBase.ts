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

/** Complete executable contract required before an adapter is certified. */
export interface IAdapterCertificationBase<
  TType extends EvidenceProgrammingType | EvidenceDatabaseType,
  TSymbol extends EvidenceProgrammingSymbol | EvidenceDatabaseSymbol,
> {
  /** Explicit language under certification. */
  type: TType;
  /** Concrete adapter being certified. */
  adapter: IEvidenceAdapter;
  /** Declared source fixtures. */
  sources: IAdapterCertificationSource[];
  /** Independent exact semantic expectations. */
  units: IAdapterCertificationUnitBase<TSymbol>[];
  /** Expected eligible or unsupported carriers. */
  hosts: IAdapterCertificationHost[];
  /** Exact acknowledgements and their host identities. */
  requirements: IAdapterCertificationRequirement[];
  /** Declarations outside the eligible population. */
  excludedUnits: string[];
  /** Number of accepted source annotation spans. */
  annotationRanges: number;
  /** Recognized unsupported surface fixture. */
  incomplete: IAdapterCertificationFailure;
  /** Parser error fixture. */
  malformed: IAdapterCertificationFailure;
  /** Attachment and inert-content counterexamples. */
  falsePositive: IAdapterCertificationFalsePositive;
  /** Annotation-only and semantic fingerprint edits. */
  mutation: IAdapterCertificationMutation;
}
