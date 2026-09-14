import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/** One explicit Zig declaration before public aliases are reconciled. */
export interface IZigDeclaration {
  /** Stable extraction identity, including its exposed path. */
  id: string;

  /** Canonical source declaration name. */
  name: string;

  /** Common selector for this declaration. */
  symbol: EvidenceProgrammingSymbol;

  /** Canonical lexical ownership path. */
  identity: string[];

  /** Public accessor, which may differ through an alias. */
  address: string[];

  /** Original source site and fingerprint content. */
  site: IEvidenceUnitSite;

  /** Whether this declaration is exposed by the selected source. */
  public: boolean;

  /** Whether this record intentionally contributes an alias site. */
  alias: boolean;

  /** Explicit containing declaration identity. */
  ownerDeclarationId?: string;
}
