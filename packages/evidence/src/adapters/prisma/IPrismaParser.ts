/** Resolved Prisma WASM parser and its diagnostic identity. */
export interface IPrismaParser {
  getDatamodel(parameters: string): string;
  version: string;
  origin: string;
}
