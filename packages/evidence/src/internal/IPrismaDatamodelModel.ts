import type { IPrismaDatamodelField } from "./IPrismaDatamodelField";

/** One model or view returned by Prisma's schema parser. */
export interface IPrismaDatamodelModel {
  name: string;
  documentation?: string | null;
  fields: IPrismaDatamodelField[];
}
