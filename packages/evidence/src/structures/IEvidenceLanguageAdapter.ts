import type { EvidenceProgrammingSymbol } from "../typings/EvidenceProgrammingSymbol";

/**
 * Certified declaration and documentation boundaries of a programming adapter.
 *
 * Capability inspection publishes this contract alongside grammar metadata so
 * authors can see which public surfaces and citation spellings extraction
 * supports. Unsupported cases remain explicit instead of being implied by
 * grammar coverage.
 */
export interface IEvidenceLanguageAdapter {
  /**
   * Public constructor name exposing the certified adapter.
   *
   * This connects catalog inspection to the programmatic extraction entry
   * point.
   */
  entry: string;

  /**
   * Programming symbol selectors supported by extraction.
   *
   * These classify semantic units for population selection after parsing.
   */
  symbols: EvidenceProgrammingSymbol[];

  /**
   * Description of the public declaration surface established by the adapter.
   *
   * Language-specific export and visibility rules determine which declarations
   * can become public evidence units.
   */
  publicSurface: string;

  /**
   * Canonical public-address and ownership policy for extracted declarations.
   *
   * This explains how authors name targets, including language-specific member
   * or module qualification.
   */
  addressing: string;

  /**
   * Documentation forms accepted as annotation carriers.
   *
   * Ordinary comments or strings outside these supported forms cannot establish
   * Evidence merely by containing tag-like text.
   */
  comments: string[];

  /**
   * Known source capabilities outside the adapter's certified extraction
   * boundary.
   *
   * These limitations qualify the public-surface description for capability
   * readers.
   */
  unsupported: string[];
}
