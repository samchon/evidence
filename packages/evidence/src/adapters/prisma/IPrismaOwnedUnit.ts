import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";
import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";

/** Prisma unit beside the parser documentation used to recover withdrawal state.
 *
 * Ownership is kept explicitly because unit materialization needs both semantic
 * output and the comment text that established its review state.
 */
export interface IPrismaOwnedUnit {
  /** Identity joining the unit to position and documentation records. */
  key: string;

  /** Parser documentation associated with this semantic unit. */
  documentation: string;

  /** Materialized public or internal Evidence unit. */
  unit: IEvidenceUnit;

  /** Physical declaration site that owns the unit fingerprint. */
  site: IEvidenceUnitSite;
}
