/** One recognized Prisma top-level block declaration.
 *
 * The position scanner records only the head needed to associate parser-owned
 * semantic models with their original source spans.
 */
export interface IPrismaBlockHead {
  /** Prisma block kind, such as `model` or `view`. */
  keyword: string;

  /** Declared block name following the recognized keyword. */
  name: string;
}
