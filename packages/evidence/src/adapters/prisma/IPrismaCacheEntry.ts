import type { IPrismaModel } from "./IPrismaModel";

/** Remembered Prisma parse outcome for one parser and schema digest.
 *
 * Parser version and complete schema content form the external cache key so
 * stale parser behavior cannot be reused for a changed schema set.
 */
export interface IPrismaCacheEntry {
  /** Parser-normalized models after a successful parse. */
  models?: IPrismaModel[];

  /** Stable parser failure for the cached input, when parsing failed. */
  problem?: string;
}
