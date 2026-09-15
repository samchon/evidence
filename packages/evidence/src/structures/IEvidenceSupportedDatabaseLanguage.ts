import type { EvidenceDatabaseType } from "../typings/EvidenceDatabaseType";
import type { IEvidenceDatabaseLanguageAdapter } from "./IEvidenceDatabaseLanguageAdapter";
import type { IEvidenceLanguageGrammar } from "./IEvidenceLanguageGrammar";

/**
 * Database capability entry guaranteed to have a certified schema adapter.
 *
 * Supported-database queries use this narrower shape after excluding
 * grammar-only entries. The required adapter contract lets callers inspect
 * extraction and target-address boundaries without another availability check.
 */
export interface IEvidenceSupportedDatabaseLanguage {
  /**
   * Configuration discriminator selecting this database family.
   *
   * Claims and references use this value to choose schema extraction.
   */
  type: EvidenceDatabaseType;

  /**
   * Display label for the supported schema language.
   *
   * Reports retain the separate type discriminator for configuration use.
   */
  name: string;

  /**
   * Grammar variants and logical filename rules associated with the adapter.
   *
   * These describe syntax selection without implying that metadata inspection
   * loads WASM.
   */
  grammars: IEvidenceLanguageGrammar[];

  /**
   * Guaranteed schema extraction and documentation-host contract.
   *
   * This includes selectors, address policy, and explicit unsupported
   * capabilities.
   */
  adapter: IEvidenceDatabaseLanguageAdapter;
}
