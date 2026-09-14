import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";
import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";

/** Prisma unit beside the parser documentation used to recover withdrawal state.
 *
 * Ownership is kept explicitly because unit materialization needs both semantic
 * output and the comment text that established its review state.
 */
export interface IPrismaOwnedUnit {
  /**
   * Identity joining the unit to position and documentation records.
   *
   * This key connects parser-owned semantic output with the physical scan that
   * establishes the site and comment carrier for the materialized unit.
   */
  key: string;

  /**
   * Parser documentation associated with this semantic unit.
   *
   * Withdrawal and review handling reads this value after it establishes a host,
   * preserving the parser's documentation independently of source coordinates.
   */
  documentation: string;

  /**
   * Materialized public or internal Evidence unit.
   *
   * This unit carries the semantic identity and selection state that graph
   * evaluation consumes after the Prisma adapter completes materialization.
   */
  unit: IEvidenceUnit;

  /**
   * Physical declaration site that owns the unit fingerprint.
   *
   * The site preserves position and content ranges from the scanner, which are
   * required to compare review fingerprints against authored source changes.
   */
  site: IEvidenceUnitSite;
}
