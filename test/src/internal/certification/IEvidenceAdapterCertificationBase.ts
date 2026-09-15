import type {
  EvidenceProgrammingType,
  EvidenceDatabaseType,
  EvidenceProgrammingSymbol,
  EvidenceDatabaseSymbol,
  IEvidenceAdapter,
} from "evidence";
import type { IEvidenceAdapterCertificationFailure } from "./IEvidenceAdapterCertificationFailure";
import type { IEvidenceAdapterCertificationFalsePositive } from "./IEvidenceAdapterCertificationFalsePositive";
import type { IEvidenceAdapterCertificationHost } from "./IEvidenceAdapterCertificationHost";
import type { IEvidenceAdapterCertificationMutation } from "./IEvidenceAdapterCertificationMutation";
import type { IEvidenceAdapterCertificationRequirement } from "./IEvidenceAdapterCertificationRequirement";
import type { IEvidenceAdapterCertificationSource } from "./IEvidenceAdapterCertificationSource";
import type { IEvidenceAdapterCertificationUnitBase } from "./IEvidenceAdapterCertificationUnitBase";

/** Complete executable contract required before an adapter is certified. */
export interface IEvidenceAdapterCertificationBase<
  TType extends EvidenceProgrammingType | EvidenceDatabaseType,
  TSymbol extends EvidenceProgrammingSymbol | EvidenceDatabaseSymbol,
> {
  /** Explicit language under certification. */
  type: TType;

  /** Concrete adapter being certified. */
  adapter: IEvidenceAdapter;

  /** Declared source fixtures. */
  sources: IEvidenceAdapterCertificationSource[];

  /** Independent exact semantic expectations. */
  units: IEvidenceAdapterCertificationUnitBase<TSymbol>[];

  /** Expected eligible or unsupported carriers. */
  hosts: IEvidenceAdapterCertificationHost[];

  /** Exact acknowledgements and their host identities. */
  requirements: IEvidenceAdapterCertificationRequirement[];

  /** Declarations outside the eligible population. */
  excludedUnits: string[];

  /** Number of accepted source annotation spans. */
  annotationRanges: number;

  /** Recognized unsupported surface fixture. */
  incomplete: IEvidenceAdapterCertificationFailure;

  /** Parser error fixture. */
  malformed: IEvidenceAdapterCertificationFailure;

  /** Attachment and inert-content counterexamples. */
  falsePositive: IEvidenceAdapterCertificationFalsePositive;

  /** Annotation-only and semantic fingerprint edits. */
  mutation: IEvidenceAdapterCertificationMutation;
}
