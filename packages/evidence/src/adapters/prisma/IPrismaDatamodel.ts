import type { IPrismaDatamodelModel } from "./IPrismaDatamodelModel";

/** Prisma parser payload needed by the Evidence adapter. */
export interface IPrismaDatamodel {
  models: IPrismaDatamodelModel[];
}
