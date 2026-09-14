import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/**
 * Represents a Scala source declaration before snapshot-wide overload reconciliation.
 *
 * The record preserves lexical identity separately from exported addresses so
 * singleton exports and overloads can be published without collapsing sites.
 */
export interface IScalaDeclaration {
  /** Stable extraction record identity. */
  id: string;

  /** Literal Scala source name. */
  name: string;

  /** Public programming selector. */
  symbol: EvidenceProgrammingSymbol;

  /** Package and lexical owner identity. */
  identity: string[];

  /** File-qualified public address. */
  address: string[];

  /**
   * Supplies source names that a bounded export may use during lookup.
   *
   * These names are not automatically public addresses; limiting lookup to
   * them prevents arbitrary textual paths from becoming aliases.
   */
  lookup: string[];

  /** Original declaration and fingerprint ranges. */
  site: IEvidenceUnitSite;

  /** Whether the declaration and its owners have unrestricted visibility. */
  public: boolean;

  /**
   * Identifies a singleton object eligible to supply an exported member.
   *
   * Scala's export syntax is resolved only through these static object owners,
   * avoiding an unsupported inference through arbitrary expressions.
   */
  object: boolean;

  /** Source node spelling used for semantic boundary checks. */
  syntax: string;

  /** Explicit lexical parent declaration. */
  ownerDeclarationId?: string;
}
