import type { EvidProgrammingType } from "../typings/EvidProgrammingType";
import type { IEvidLanguageAdapter } from "./IEvidLanguageAdapter";
import type { IEvidLanguageGrammar } from "./IEvidLanguageGrammar";

/**
 * Programming-language catalog entry separating parsing from Evid extraction.
 *
 * A grammar can recognize syntax before an adapter has established declaration
 * identity, visibility, and documentation ownership. Optional adapter metadata
 * prevents grammar availability from being advertised as certified graph support.
 */
export interface IEvidLanguage {
  /**
   * Programming artifact discriminator accepted by configuration and parser selection.
   *
   * A single family can select several grammar variants by logical filename.
   */
  type: EvidProgrammingType;

  /**
   * Human-readable language name shown by capability inspection.
   *
   * Callers use the type discriminator, rather than this display label, in configuration.
   */
  name: string;

  /**
   * Syntax variants and their accepted case-sensitive source spellings.
   *
   * These describe grammar selection without loading any WASM bytes.
   */
  grammars: IEvidLanguageGrammar[];

  /**
   * Certified Evid extraction capabilities, when an adapter is available.
   *
   * Omission means grammar metadata alone must not be treated as supported
   * declaration, visibility, ownership, or documentation-host extraction.
   */
  adapter?: IEvidLanguageAdapter;
}
