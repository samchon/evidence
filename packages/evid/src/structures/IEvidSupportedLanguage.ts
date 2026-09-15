import type { EvidProgrammingType } from "../typings/EvidProgrammingType";
import type { IEvidLanguageAdapter } from "./IEvidLanguageAdapter";
import type { IEvidLanguageGrammar } from "./IEvidLanguageGrammar";

/**
 * Programming capability entry with a certified adapter guaranteed present.
 *
 * Supported-language queries narrow the broader grammar catalog to entries that
 * can extract Evid inventories. Consumers can inspect adapter boundaries
 * directly without mistaking a grammar-only entry for implemented graph support.
 */
export interface IEvidSupportedLanguage {
  /**
   * Configuration discriminator for the supported programming family.
   *
   * This is the value authors use to select the adapter in a population.
   */
  type: EvidProgrammingType;

  /**
   * Display name accompanying the family discriminator.
   *
   * It is intended for capability reports rather than target or identity matching.
   */
  name: string;

  /**
   * Registered grammar variants and accepted logical filenames.
   *
   * Several syntax variants can share one certified declaration adapter.
   */
  grammars: IEvidLanguageGrammar[];

  /**
   * Certified extraction and documentation-host contract for this family.
   *
   * Unlike the broader catalog entry, this supported entry always provides it.
   */
  adapter: IEvidLanguageAdapter;
}
