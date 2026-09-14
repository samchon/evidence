import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";

/**
 * Represents a MATLAB declaration before class-folder and accessor reconciliation.
 *
 * MATLAB can separate a public signature, implementation file, and property
 * accessors, so this record retains those physical facts until ownership is known.
 */
export interface IMatlabDeclaration {
  /**
   * Identifies this physical declaration extracted from the selected source.
   *
   * Documentation attachments and later ownership links use it before unit IDs exist.
   */
  id: string;

  /**
   * Stores the literal MATLAB identifier from the declaration.
   *
   * The resolver appends it to its owner path when creating a public unit address.
   */
  name: string;

  /**
   * Classifies the declaration in Evidence's shared programming selector model.
   *
   * This distinguishes types, functions, and properties during graph selection.
   */
  symbol: EvidenceProgrammingSymbol;

  /**
   * Names package and lexical-owner segments that define semantic identity.
   *
   * Ownership reconciliation may replace this path for an external class method.
   */
  identity: string[];

  /**
   * Names the public accessor segments projected from a selected source file.
   *
   * The array remains distinct from identity because external methods have class-file aliases.
   */
  address: string[];

  /**
   * Identifies the physical file that establishes this declaration's ownership.
   *
   * The resolver uses this anchor to match external members with their class definition.
   */
  anchor: string;

  /**
   * States whether static MATLAB visibility exposes this declaration publicly.
   *
   * Ownership and accessor reconciliation can further restrict an initially visible record.
   */
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

  /**
   * Identifies a getter or setter that contributes to an existing property unit.
   *
   * Omission means this declaration is independently materialized rather than an accessor.
   */
  accessor?: "get" | "set";

  /**
   * Records whether the declared property has public read access.
   *
   * It determines whether a matching getter can remain on the public surface.
   */
  getPublic?: boolean;

  /**
   * Records whether the declared property has public write access.
   *
   * It determines whether a matching setter can remain on the public surface.
   */
  setPublic?: boolean;

  /**
   * Lists additional public class-file projections for an external method.
   *
   * Each file supplies an address for the same semantic unit, rather than a
   * duplicate declaration that would inflate coverage.
   */
  publicFiles?: string[];

  /**
   * References the scanner-local parent declaration when one exists.
   *
   * Omission denotes a top-level function or class before ownership reconciliation.
   */
  ownerDeclarationId?: string;

  /**
   * Holds physical declaration and content spans for hosts and fingerprints.
   *
   * Materialized units retain these ranges even when ownership joins several files.
   */
  site: IEvidenceUnitSite;
}
