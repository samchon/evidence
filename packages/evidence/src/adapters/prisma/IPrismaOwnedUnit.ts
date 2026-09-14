import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";
import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";

/** Prisma unit beside the parser documentation used to recover withdrawal state. */
export interface IPrismaOwnedUnit {
  key: string;
  documentation: string;
  unit: IEvidenceUnit;
  site: IEvidenceUnitSite;
}
