import type { IEvidPrismaDatamodelModel } from "./IEvidPrismaDatamodelModel";

/**
 * Prisma parser payload needed by the Evid adapter.
 *
 * Evid deliberately consumes the parser's semantic model rather than inferring
 * model structure from source text.
 */
export interface IEvidPrismaDatamodel {
  /**
   * Parsed models and views in parser-provided order.
   *
   * `EvidPrismaModelLoader` converts these semantic roots into detached Evid
   * models before later source scanning associates them with physical sites.
   */
  models: IEvidPrismaDatamodelModel[];
}
