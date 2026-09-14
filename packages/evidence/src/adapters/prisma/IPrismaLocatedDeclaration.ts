import type { IPrismaFileAnalysis } from "./IPrismaFileAnalysis";
import type { IPrismaLocation } from "./IPrismaLocation";

/** Prisma declaration location paired with its source analysis. */
export interface IPrismaLocatedDeclaration {
  analysis: IPrismaFileAnalysis;
  location: IPrismaLocation;
}
