import type { IPrismaField } from "./IPrismaField";

/** One parser-normalized Prisma model or view.
 *
 * The model is the ownership root for materialized members and exposes only
 * detached semantic data that can safely outlive the parser call.
 */
export interface IPrismaModel {
  /** Public Prisma model or view name. */
  name: string;

  /** Block documentation used for model-level review metadata. */
  documentation: string;

  /** Semantic block digest excluding documentation directives. */
  digest: string;

  /** Parser-classified members owned by this model. */
  fields: IPrismaField[];
}
