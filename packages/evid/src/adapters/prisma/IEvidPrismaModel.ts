import type { IEvidPrismaField } from "./IEvidPrismaField";

/**
 * One parser-normalized Prisma model or view.
 *
 * The model is the ownership root for materialized members and exposes only
 * detached semantic data that can safely outlive the parser call.
 */
export interface IEvidPrismaModel {
  /**
   * Public Prisma model or view name.
   *
   * This parser-normalized name forms the root of each model and member
   * identity that the adapter later exposes through its Evid inventory.
   */
  name: string;

  /**
   * Block documentation used for model-level review metadata.
   *
   * The empty string means the parser supplied no documentation; later
   * attachment still uses the physical scanner to decide whether a carrier is
   * eligible.
   */
  documentation: string;

  /**
   * Semantic block digest excluding documentation directives.
   *
   * This content contribution lets reviews detect a changed model declaration
   * while annotations and prose do not alter the semantic fingerprint.
   */
  digest: string;

  /**
   * Parser-classified members owned by this model.
   *
   * The model owns their identity hierarchy, while each field retains a
   * separate normalized symbol, documentation text, and semantic digest.
   */
  fields: IEvidPrismaField[];
}
