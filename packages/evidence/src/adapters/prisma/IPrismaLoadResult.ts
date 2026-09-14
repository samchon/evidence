import type { IPrismaModel } from "./IPrismaModel";

/** Parsed schema units beside the whole-set cache identity. */
export interface IPrismaLoadResult {
  models: IPrismaModel[];
  digest: string;
}
