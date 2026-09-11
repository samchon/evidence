import type { EvidenceDatabaseSymbol } from "../typings/EvidenceDatabaseSymbol";

/** One parser-classified Prisma model member. */
export interface IPrismaField {
  name: string;
  symbol: Exclude<EvidenceDatabaseSymbol, "model">;
  documentation: string;
  digest: string;
}
