import type { IPrismaModel } from "./IPrismaModel";

/** Remembered Prisma parse outcome for one parser and schema digest. */
export interface IPrismaCacheEntry {
  models?: IPrismaModel[];
  problem?: string;
}
