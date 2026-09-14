import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/**
 * Represents one explicit Zig declaration before public aliases are reconciled.
 *
 * A record separates semantic identity from the exported path because Zig
 * aliases can expose one declaration at more than one address.
 */
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

  /**
   * Marks a projection that contributes an additional public alias site.
   *
   * Alias projections do not create another unit; they allow target lookup and
   * documentation hosts to retain every supported public spelling.
   */
  alias: boolean;

  /** Explicit containing declaration identity. */
  ownerDeclarationId?: string;
}
