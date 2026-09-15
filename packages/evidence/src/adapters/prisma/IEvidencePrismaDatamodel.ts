import type { IEvidencePrismaDatamodelModel } from "./IEvidencePrismaDatamodelModel";

/**
 * Prisma parser payload needed by the evidence adapter.
 *
 * evidence deliberately consumes the parser's semantic model rather than inferring
 * model structure from source text.
 */
export interface IEvidencePrismaDatamodel {
  /**
   * Parsed models and views in parser-provided order.
   *
   * `EvidencePrismaModelLoader` converts these semantic roots into detached evidence
   * models before later source scanning associates them with physical sites.
   */
  models: IEvidencePrismaDatamodelModel[];
}
