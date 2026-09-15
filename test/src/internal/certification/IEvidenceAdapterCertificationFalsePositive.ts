import type { IEvidenceAdapterCertificationSource } from "./IEvidenceAdapterCertificationSource";

/**
 * Attached documentation paired with tag-shaped literal text that must stay
 * unsupported.
 */
export interface IEvidenceAdapterCertificationFalsePositive {
  source: IEvidenceAdapterCertificationSource;
  attachedTarget: string;
  unsupportedAnnotations: number;
}
