/** Resolved Prisma WASM parser and its diagnostic identity.
 *
 * The adapter records the parser implementation identity in cache keys because
 * parser upgrades can change semantic output for unchanged schema text.
 */
export interface IPrismaParser {
  /** Parses the complete schema parameter payload into serialized JSON. */
  getDatamodel(parameters: string): string;

  /** Parser version contributing to the whole-set cache identity. */
  version: string;

  /** Human-readable implementation origin for diagnostics. */
  origin: string;
}
