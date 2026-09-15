import type { IEvidPrismaDatamodelField } from "./IEvidPrismaDatamodelField";

/** One model or view returned by Prisma's schema parser.
 *
 * The loader later pairs this semantic result with a physical source location
 * instead of treating parser output as an independently owned artifact.
 */
export interface IEvidPrismaDatamodelModel {
  /**
   * Parser-resolved model or view name.
   *
   * This name joins a semantic model from the WASM parser to its separately
   * scanned source declaration and to its materialized Evid identity.
   */
  name: string;

  /**
   * Parser-attached block documentation when present.
   *
   * Omission or `null` means the parser found no block documentation;
   * `EvidPrismaModelLoader` normalizes both states to its detached empty text value.
   */
  documentation?: string | null;

  /**
   * Members belonging to this parser-established model.
   *
   * Their parser classifications are converted into Evid columns or
   * relations only after the containing model has been materialized.
   */
  fields: IEvidPrismaDatamodelField[];
}
