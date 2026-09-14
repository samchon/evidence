import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/**
 * Represents a MATLAB declaration before class-folder and accessor reconciliation.
 *
 * MATLAB can separate a public signature, implementation file, and property
 * accessors, so this record retains those physical facts until ownership is known.
 */
export interface IMatlabDeclaration {
  /** Unique extraction site identity. */
  id: string;

  /** Literal declaration name. */
  name: string;

  /** Common selector. */
  symbol: EvidenceProgrammingSymbol;

  /** Package and lexical owner segments. */
  identity: string[];

  /** Public file accessor segments. */
  address: string[];

  /** Physical file establishing semantic ownership. */
  anchor: string;

  /** Whether the declaration is externally accessible. */
  public: boolean;

  /**
   * Names the class-folder owner required by an external method declaration.
   *
   * The resolver uses this physical relationship to reject same-named methods
   * from an unrelated class before assigning a semantic parent.
   */
  externalOwner?: string;

  /**
   * Identifies the selected implementation required by a nonabstract signature.
   *
   * Keeping the required file explicit lets incomplete input fail instead of
   * silently shrinking the population to only declarations with bodies.
   */
  implementation?: string;

  /** A getter or setter that belongs to an existing property. */
  accessor?: "get" | "set";

  /** Property read access. */
  getPublic?: boolean;

  /** Property write access. */
  setPublic?: boolean;

  /**
   * Lists additional public class-file projections for an external method.
   *
   * Each file supplies an address for the same semantic unit, rather than a
   * duplicate declaration that would inflate coverage.
   */
  publicFiles?: string[];

  /** Explicit parent extraction identity. */
  ownerDeclarationId?: string;

  /** Original declaration and fingerprint spans. */
  site: IEvidenceUnitSite;
}
