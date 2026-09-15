import type { EvidenceProgrammingType } from "../typings/EvidenceProgrammingType";
import type { IEvidenceLanguageAdapter } from "./IEvidenceLanguageAdapter";
import type { IEvidenceLanguageGrammar } from "./IEvidenceLanguageGrammar";

/**
 * Programming-language catalog entry separating parsing from evidence extraction.
 *
 * A grammar can recognize syntax before an adapter has established declaration
 * identity, visibility, and documentation ownership. Optional adapter metadata
 * prevents grammar availability from being advertised as certified graph
 * support.
 */
export interface IEvidenceLanguage {
  /**
   * Programming artifact discriminator accepted by configuration and parser
   * selection.
   *
   * A single family can select several grammar variants by logical filename.
   */
  type: EvidenceProgrammingType;

  /**
   * Human-readable language name shown by capability inspection.
   *
   * Callers use the type discriminator, rather than this display label, in
   * configuration.
   */
  name: string;

  /**
   * Syntax variants and their accepted case-sensitive source spellings.
   *
   * These describe grammar selection without loading any WASM bytes.
   */
  grammars: IEvidenceLanguageGrammar[];

  /**
   * Certified evidence extraction capabilities, when an adapter is available.
   *
   * Omission means grammar metadata alone must not be treated as supported
   * declaration, visibility, ownership, or documentation-host extraction.
   */
  adapter?: IEvidenceLanguageAdapter;
}
