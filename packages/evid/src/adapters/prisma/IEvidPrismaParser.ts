/** Resolved Prisma WASM parser and its diagnostic identity.
 *
 * The adapter records the parser implementation identity in cache keys because
 * parser upgrades can change semantic output for unchanged schema text.
 */
export interface IEvidPrismaParser {
  /**
   * Parses the complete schema parameter payload into serialized JSON.
   *
   * `EvidPrismaModelLoader` supplies every selected file in the parser's expected
   * payload shape, then validates the returned JSON as `IEvidPrismaDatamodel`.
   */
  getDatamodel(parameters: string): string;

  /**
   * Parser version contributing to the whole-schema cache identity.
   *
   * A version change invalidates cached semantic output even when selected source
   * content has not changed, because parser behavior can alter the datamodel.
   */
  version: string;

  /**
   * Human-readable implementation origin for diagnostics.
   *
   * The loader reports whether resolution selected the consumer project or the
   * Evid package copy when parser loading or parsing fails.
   */
  origin: string;
}
