import type { IEvidUnitSite } from "../../structures/IEvidUnitSite";
import type { EvidProgrammingSymbol } from "../../typings/EvidProgrammingSymbol";

/**
 * Represents one explicit Zig declaration before public aliases are reconciled.
 *
 * A record separates semantic identity from the exported path because Zig
 * aliases can expose one declaration at more than one address.
 */
export interface IEvidZigDeclaration {
  /**
   * Identifies this extracted declaration at one physical site and exposed path.
   *
   * Alias reconciliation uses the key to connect documentation attachments before
   * it merges alias projections into their canonical semantic unit.
   */
  id: string;

  /**
   * Names the declaration in its defining Zig source container.
   *
   * The adapter preserves this canonical name when an alias publishes the same
   * declaration under a different final public accessor segment.
   */
  name: string;

  /**
   * Classifies the declaration with Evid's shared programming symbol.
   *
   * Unit materialization retains this classification when it merges physical
   * sites and assigns the declaration's stable semantic identity.
   */
  symbol: EvidProgrammingSymbol;

  /**
   * Records the declaration's canonical lexical ownership path.
   *
   * This path defines semantic identity independently of aliases that expose
   * the declaration through additional public accessors.
   */
  identity: string[];

  /**
   * Lists public accessor segments that reach this physical declaration.
   *
   * Alias projections may differ from {@link identity}; publication uses these
   * segments to create every supported file-qualified public address.
   */
  address: string[];

  /**
   * Preserves the declaration's physical source site and fingerprint content.
   *
   * Materialization clones this site into the semantic unit so source review
   * retains its location even after the parser session has closed.
   */
  site: IEvidUnitSite;

  /**
   * Indicates whether the selected source exposes this declaration publicly.
   *
   * The adapter publishes only public records, while non-public boundaries can
   * still be retained during extraction when needed for scanner classification.
   */
  public: boolean;

  /**
   * Marks a projection that contributes an additional public alias site.
   *
   * Alias projections do not create another unit; they allow target lookup and
   * documentation hosts to retain every supported public spelling.
   */
  alias: boolean;

  /**
   * Identifies the explicit declaration that lexically owns this member.
   *
   * Omission marks a file-level declaration; otherwise materialization maps the
   * owner to a unit parent so withdrawals propagate through the container tree.
   */
  ownerDeclarationId?: string;
}
