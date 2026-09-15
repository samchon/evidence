/**
 * One recognized Prisma top-level block declaration.
 *
 * The position scanner records only the head needed to associate parser-owned
 * semantic models with their original source spans.
 */
export interface IEvidencePrismaBlockHead {
  /**
   * Prisma block kind, such as `model` or `view`.
   *
   * The position scanner combines this keyword with `name` to recognize only
   * block forms that can be paired with parser-established semantic models.
   */
  keyword: string;

  /**
   * Declared block name following the recognized keyword.
   *
   * This authored spelling supplies the physical lookup key; semantic validity
   * still belongs to the whole-schema parser rather than this lexical scan.
   */
  name: string;
}
