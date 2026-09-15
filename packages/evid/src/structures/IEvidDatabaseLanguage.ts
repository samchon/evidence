import type { EvidDatabaseType } from "../typings/EvidDatabaseType";
import type { IEvidDatabaseLanguageAdapter } from "./IEvidDatabaseLanguageAdapter";
import type { IEvidLanguageGrammar } from "./IEvidLanguageGrammar";

/**
 * Database-language catalog entry separating grammar availability from schema extraction.
 *
 * A parser recognizing schema syntax does not establish model, column, relation,
 * or documentation ownership. Adapter metadata appears only when those Evid
 * boundaries are certified, allowing catalog inspection without overstating support.
 */
export interface IEvidDatabaseLanguage {
  /**
   * Database family discriminator used in population configuration.
   *
   * Grammar and adapter selection remain scoped to this configured family.
   */
  type: EvidDatabaseType;

  /**
   * Human-readable schema-language name.
   *
   * Capability reports display this label alongside the configuration discriminator.
   */
  name: string;

  /**
   * Pinned grammar variants and their accepted logical file spellings.
   *
   * Reading these selection rules does not acquire or initialize a grammar.
   */
  grammars: IEvidLanguageGrammar[];

  /**
   * Certified schema extraction capabilities, when available.
   *
   * Omission means grammar availability alone cannot certify Evid units,
   * structural ownership, or annotation hosts for the language.
   */
  adapter?: IEvidDatabaseLanguageAdapter;
}
