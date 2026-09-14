import type { IPrismaField } from "./IPrismaField";

/** One parser-normalized Prisma model or view. */
export interface IPrismaModel {
  name: string;
  documentation: string;
  digest: string;
  fields: IPrismaField[];
}
