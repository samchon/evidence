import type { IPrismaDatamodelModel } from "./IPrismaDatamodelModel";

/** Prisma parser payload needed by the Evidence adapter.
 *
 * Evidence deliberately consumes the parser's semantic model rather than
 * inferring model structure from source text.
 */
export interface IPrismaDatamodel {
  /**
   * Parsed models and views in parser-provided order.
   *
   * `PrismaModelLoader` converts these semantic roots into detached Evidence
   * models before later source scanning associates them with physical sites.
   */
  models: IPrismaDatamodelModel[];
}
