import type { IPrismaDatamodelField } from "./IPrismaDatamodelField";

/** One model or view returned by Prisma's schema parser.
 *
 * The loader later pairs this semantic result with a physical source location
 * instead of treating parser output as an independently owned artifact.
 */
export interface IPrismaDatamodelModel {
  /** Parser-resolved model or view name. */
  name: string;

  /** Parser-attached block documentation, when present. */
  documentation?: string | null;

  /** Members belonging to this parser-established model. */
  fields: IPrismaDatamodelField[];
}
