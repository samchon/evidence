import type {
  EvidProgrammingType,
  EvidDatabaseType,
  EvidProgrammingSymbol,
  EvidDatabaseSymbol,
  IEvidAdapter,
} from "evid";
import type { IEvidAdapterCertificationFailure } from "./IEvidAdapterCertificationFailure";
import type { IEvidAdapterCertificationFalsePositive } from "./IEvidAdapterCertificationFalsePositive";
import type { IEvidAdapterCertificationHost } from "./IEvidAdapterCertificationHost";
import type { IEvidAdapterCertificationMutation } from "./IEvidAdapterCertificationMutation";
import type { IEvidAdapterCertificationRequirement } from "./IEvidAdapterCertificationRequirement";
import type { IEvidAdapterCertificationSource } from "./IEvidAdapterCertificationSource";
import type { IEvidAdapterCertificationUnitBase } from "./IEvidAdapterCertificationUnitBase";

/** Complete executable contract required before an adapter is certified. */
export interface IEvidAdapterCertificationBase<
  TType extends EvidProgrammingType | EvidDatabaseType,
  TSymbol extends EvidProgrammingSymbol | EvidDatabaseSymbol,
> {
  /** Explicit language under certification. */
  type: TType;

  /** Concrete adapter being certified. */
  adapter: IEvidAdapter;

  /** Declared source fixtures. */
  sources: IEvidAdapterCertificationSource[];

  /** Independent exact semantic expectations. */
  units: IEvidAdapterCertificationUnitBase<TSymbol>[];

  /** Expected eligible or unsupported carriers. */
  hosts: IEvidAdapterCertificationHost[];

  /** Exact acknowledgements and their host identities. */
  requirements: IEvidAdapterCertificationRequirement[];

  /** Declarations outside the eligible population. */
  excludedUnits: string[];

  /** Number of accepted source annotation spans. */
  annotationRanges: number;

  /** Recognized unsupported surface fixture. */
  incomplete: IEvidAdapterCertificationFailure;

  /** Parser error fixture. */
  malformed: IEvidAdapterCertificationFailure;

  /** Attachment and inert-content counterexamples. */
  falsePositive: IEvidAdapterCertificationFalsePositive;

  /** Annotation-only and semantic fingerprint edits. */
  mutation: IEvidAdapterCertificationMutation;
}
