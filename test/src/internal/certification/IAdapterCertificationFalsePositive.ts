import type { IAdapterCertificationSource } from "./IAdapterCertificationSource";

/** Attached documentation paired with tag-shaped literal text that must stay unsupported. */
export interface IAdapterCertificationFalsePositive {
  source: IAdapterCertificationSource;
  attachedTarget: string;
  unsupportedAnnotations: number;
}
