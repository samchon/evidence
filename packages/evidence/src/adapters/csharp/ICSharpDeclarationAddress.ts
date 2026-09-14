/**
 * Describes one public-address candidate for a C# declaration.
 *
 * The scanner derives candidates from namespace, type, and member containment,
 * including aliases introduced by C# syntax. `CSharpAdapter` uses their canonical
 * and alias-prefix provenance when publishing public addresses, preserving the
 * declaration's semantic identity independently from its accessible spellings.
 */
export interface ICSharpDeclarationAddress {
  /** Segmented public accessor for this declaration spelling.
   *
   * Segments avoid treating literal dots in names as containment. */
  segments: string[];

  /** Whether this spelling is the declaration family's ordinary address.
   *
   * Alias candidates are suppressed when a canonical owner is present. */
  canonical: boolean;

  /** Alias paths that must remain unoccupied before this address is published.
   *
   * This protects ownership when source aliases shadow an ordinary declaration. */
  aliasPrefixes: string[][];
}
