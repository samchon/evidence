import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceProgrammingSymbol } from "../../typings/EvidenceProgrammingSymbol";
import type { ObjcDeclarationForm } from "./ObjcDeclarationForm";

/**
 * Represents one Objective-C declaration before interface and implementation reconciliation.
 *
 * The adapter keeps declarations from headers, implementations, categories, and
 * extensions distinct until it can establish the one public semantic identity.
 */
export interface IObjcDeclaration {
  /** Physical declaration identity within the snapshot. */
  id: string;

  /** Exact declaration name, including selector punctuation. */
  name: string;

  /** Public programming selector. */
  symbol: EvidenceProgrammingSymbol;

  /** Source form governing exposure and merging. */
  form: ObjcDeclarationForm;

  /** Segmented identity in the configured declared-source boundary. */
  identity: string[];

  /** Segmented file-qualified public accessor. */
  address: string[];

  /** Original source declaration and fingerprint content ranges. */
  site: IEvidenceUnitSite;

  /** Whether this declaration participates in the public inventory after reconciliation. */
  public: boolean;

  /**
   * Permits an implementation or extension site to join a public identity.
   *
   * The flag never makes a private declaration public by itself; it authorizes
   * reconciliation with the separately extracted interface declaration.
   */
  merge: boolean;

  /**
   * Marks a body or nominal implementation site that must be unique.
   *
   * Multiple declarations can describe a selector, but conflicting definitions
   * leave the analysis incomplete rather than choosing an arbitrary site.
   */
  definition: boolean;

  /** Physical owner declaration, reconciled to a semantic parent later. */
  ownerDeclarationId?: string;
}
