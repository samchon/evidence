import type { IEvidSupportedDatabaseLanguage } from "./IEvidSupportedDatabaseLanguage";
import type { IEvidSupportedLanguage } from "./IEvidSupportedLanguage";

/**
 * Versioned catalog of certified programming and database adapter capabilities.
 *
 * This report requires no project analysis or grammar initialization. It
 * excludes grammar-only candidates and exposes each shipped adapter's
 * selectors, public surface, documentation forms, and unsupported boundaries.
 */
export interface IEvidLanguagesReport {
  /**
   * Serialization version used by capability consumers.
   *
   * Readers check it before interpreting language and adapter metadata.
   */
  schemaVersion: 1;

  /**
   * Discriminator identifying capability-catalog output.
   *
   * The operation is independent of any configured source populations.
   */
  command: "languages";

  /**
   * Number of certified entries included in the report.
   *
   * Grammar variants within a language do not each add another language entry.
   */
  total: number;

  /**
   * Supported programming and database families with required adapter
   * contracts.
   *
   * Each entry distinguishes filename-based grammar selection from semantic
   * extraction capabilities.
   */
  languages: (IEvidSupportedLanguage | IEvidSupportedDatabaseLanguage)[];
}
