import type { EvidenceProgrammingSymbol } from "../typings/EvidenceProgrammingSymbol";

/**
 * Requires documentation comments on selected public programming declarations.
 *
 * This policy checks whether declarations have documentation capable of hosting
 * Evidence. It does not judge prose quality or replace the repository's source
 * documentation rules. A narrower selector can require documentation on
 * functions without imposing the same presence check on every public property.
 */
export interface IEvidenceDocumentedConfig {
  /**
   * Symbol kinds requiring documentation; accepts one kind or a nonempty array.
   *
   * Omission checks types, functions, and properties. The selector applies to
   * public programming declarations within the configured population.
   *
   * @default ["type", "function", "property"]
   */
  symbol?: EvidenceProgrammingSymbol | EvidenceProgrammingSymbol[];
}
