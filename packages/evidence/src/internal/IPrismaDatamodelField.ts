/** One resolved model member returned by Prisma's schema parser. */
export interface IPrismaDatamodelField {
  name: string;
  kind: string;
  documentation?: string | null;
}
