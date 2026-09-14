import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceDatabaseSymbol } from "../../typings/EvidenceDatabaseSymbol";

/** A database declaration copied from its dialect's syntax tree. */
export interface ISqlDeclaration {
  /** Stable extraction record identity within the snapshot. */
  id: string;

  /** Display name of the declared schema member. */
  name: string;

  /** Shared database selector. */
  symbol: EvidenceDatabaseSymbol;

  /** File-independent qualified semantic identity segments. */
  identity: string[];

  /** Public accessor segments at this declaration site. */
  address: string[];

  /** Additional dialect-established public paths for this same declaration. */
  aliases?: string[][];

  /** Original declaration and fingerprint ranges. */
  site: IEvidenceUnitSite;

  /** Whether this declaration belongs to the selected schema surface. */
  public: boolean;

  /** Explicit owning model extraction record. */
  ownerDeclarationId?: string;

  /** Whether a dialect established this as an additional site of an existing identity. */
  merge?: boolean;
}
