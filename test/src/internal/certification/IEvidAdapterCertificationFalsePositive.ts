import type { IEvidAdapterCertificationSource } from "./IEvidAdapterCertificationSource";

/**
 * Attached documentation paired with tag-shaped literal text that must stay
 * unsupported.
 */
export interface IEvidAdapterCertificationFalsePositive {
  source: IEvidAdapterCertificationSource;
  attachedTarget: string;
  unsupportedAnnotations: number;
}
