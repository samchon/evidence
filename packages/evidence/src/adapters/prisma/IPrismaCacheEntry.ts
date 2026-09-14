import type { IPrismaModel } from "./IPrismaModel";

/** Remembered Prisma parse outcome for one parser and schema digest.
 *
 * Parser version and complete schema content form the external cache key so
 * stale parser behavior cannot be reused for a changed schema set.
 */
export interface IPrismaCacheEntry {
  /**
   * Parser-normalized models after a successful parse.
   *
   * A cache entry stores this branch for a parser-version and schema-set digest,
   * allowing callers to receive a cloned semantic model without reparsing.
   */
  models?: IPrismaModel[];

  /**
   * Stable parser failure for the cached input when parsing failed.
   *
   * `PrismaModelLoader` rethrows this remembered diagnostic for the same cache
   * key so repeated scans do not hide or reformat a deterministic parse error.
   */
  problem?: string;
}
