/**
 * Describes one public C path emitted from a declaration.
 *
 * A declaration can be reached through its ordinary identifier and, where the
 * language permits it, a tag or typedef spelling. `canonical` distinguishes the
 * spelling that establishes identity from aliases that must yield to a canonical
 * declaration occupying one of their prefixes.
 */
export interface ICDeclarationAddress {
  /** Ordered accessor segments used by Evidence target resolution. */
  segments: string[];

  /** Whether this path is the declaration's language-namespace spelling. */
  canonical: boolean;

  /** Canonical prefixes that suppress this alias when they are already occupied. */
  aliasPrefixes: string[][];
}
